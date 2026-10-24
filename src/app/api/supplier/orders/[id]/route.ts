import { prisma } from '@/lib/prisma';import { requireSupplierRole } from '@/lib/supplier-auth';import { bad,ok } from '@/lib/http';import { NotificationType,SupplierDeliveryStatus,SupplierOrderStatus } from '@prisma/client';import { plain } from '@/lib/serializers';
import {ensureMarketplaceAccounting} from '@/lib/supplier-accounting';
import {notifyShop} from '@/lib/notifications';
import {notifySupplier,notifySupplierLowStock} from '@/lib/supplier-notifications';
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){try{const s=await requireSupplierRole(['OWNER','ADMIN','MANAGER','SALES','STOCK','DELIVERY_MANAGER','CASHIER']);const{id}=await params;const b=await req.json();const o=await prisma.supplierOrder.findFirst({where:{id,companyId:s.companyId},include:{items:true,delivery:true}});if(!o)return bad('Commande introuvable',404);let status=String(b.status||o.status) as SupplierOrderStatus;if(!Object.values(SupplierOrderStatus).includes(status))return bad('Statut invalide');if(s.role==='CASHIER'&&(status===o.status||!['CONFIRMED','PREPARING','READY_FOR_DELIVERY'].includes(status)))return bad('Le caissier peut seulement confirmer ou préparer une commande et la rendre disponible au livreur',403);const flow:Record<string,SupplierOrderStatus[]>={PENDING:[SupplierOrderStatus.CONFIRMED,SupplierOrderStatus.CANCELLED],CONFIRMED:[SupplierOrderStatus.PREPARING,SupplierOrderStatus.CANCELLED],PREPARING:[SupplierOrderStatus.READY_FOR_DELIVERY,SupplierOrderStatus.CANCELLED],READY_FOR_DELIVERY:[SupplierOrderStatus.OUT_FOR_DELIVERY,SupplierOrderStatus.CANCELLED],OUT_FOR_DELIVERY:[SupplierOrderStatus.DELIVERED],DELIVERED:[],CANCELLED:[]};if(status!==o.status&&!flow[o.status]?.includes(status))return bad('Transition de commande invalide',409);
if(status===SupplierOrderStatus.DELIVERED&&o.delivery?.driverAccountId)
 return bad('La preuve de livraison doit être confirmée par le livreur avec le code de remise.',409);
if(status===SupplierOrderStatus.OUT_FOR_DELIVERY&&o.delivery?.driverAccountId)
 return bad('La prise en charge est réservée au livreur affecté.',409);if(status===SupplierOrderStatus.CANCELLED&&o.status!==SupplierOrderStatus.CANCELLED){
 const allocations=await prisma.supplierOrderStockAllocation.findMany({where:{orderId:id}});
 await prisma.$transaction(async tx=>{
  const transition=await tx.supplierOrder.updateMany({
    where:{id,companyId:s.companyId,status:o.status},data:{status:SupplierOrderStatus.CANCELLED}
  });
  if(transition.count!==1)throw Object.assign(new Error('Commande déjà modifiée. Actualisez la page.'),{status:409});
  for(const i of o.items)await tx.supplierProduct.update({where:{id:i.productId},data:{stock:{increment:i.quantity}}});
  for(const a of allocations)if(a.warehouseId)await tx.supplierWarehouseStock.upsert({where:{warehouseId_productId:{warehouseId:a.warehouseId,productId:a.productId}},update:{quantity:{increment:a.quantity}},create:{companyId:s.companyId,warehouseId:a.warehouseId,productId:a.productId,quantity:a.quantity}});
  await tx.supplierAuditEvent.create({data:{companyId:s.companyId,accountId:s.id,action:'RESTOCK_CANCEL',entity:'SUPPLIER_ORDER',entityId:id,metadata:{allocations:allocations.map(a=>({productId:a.productId,warehouseId:a.warehouseId,quantity:a.quantity}))}}});
 });
}const order=await prisma.supplierOrder.update({where:{id},data:{status,confirmedAt:(status===SupplierOrderStatus.CONFIRMED||status===SupplierOrderStatus.READY_FOR_DELIVERY)&&!o.confirmedAt?new Date():undefined}});if(['READY_FOR_DELIVERY','OUT_FOR_DELIVERY','DELIVERED'].includes(status)){const ds=status==='DELIVERED'?SupplierDeliveryStatus.DELIVERED:status==='OUT_FOR_DELIVERY'?SupplierDeliveryStatus.OUT_FOR_DELIVERY:SupplierDeliveryStatus.PENDING;await prisma.supplierDelivery.upsert({where:{orderId:id},update:{status:ds,driverName:b.driverName||undefined,driverPhone:b.driverPhone||undefined,trackingNote:b.trackingNote||undefined,deliveredAt:ds===SupplierDeliveryStatus.DELIVERED?new Date():undefined},create:{orderId:id,status:ds,cashDue:o.total,driverName:b.driverName||null,driverPhone:b.driverPhone||null,trackingNote:b.trackingNote||null}});if(Number.isFinite(Number(b.latitude))&&Number.isFinite(Number(b.longitude))){await prisma.supplierDriverLocation.create({data:{companyId:s.companyId,orderId:id,accountId:s.id,latitude:Number(b.latitude),longitude:Number(b.longitude),accuracy:Number.isFinite(Number(b.accuracy))?Number(b.accuracy):null}})}}if(status!==o.status){
 const shopMessage:Record<string,{title:string;message:string;type:NotificationType}>={
  CONFIRMED:{title:'Commande fournisseur confirmée',message:`La commande ${o.id.slice(-6).toUpperCase()} a été confirmée par le fournisseur.`,type:NotificationType.SUCCESS},
  PREPARING:{title:'Commande en préparation',message:'Votre fournisseur prépare actuellement votre commande.',type:NotificationType.INFO},
  READY_FOR_DELIVERY:{title:'Commande prête',message:'Votre commande est prête pour la livraison.',type:NotificationType.SUCCESS},
  OUT_FOR_DELIVERY:{title:'Commande en livraison',message:'Votre commande est partie en livraison.',type:NotificationType.INFO},
  DELIVERED:{title:'Commande livrée',message:'Votre commande fournisseur a été marquée comme livrée.',type:NotificationType.SUCCESS},
  CANCELLED:{title:'Commande annulée',message:'Votre commande fournisseur a été annulée.',type:NotificationType.WARNING}
 };
 const n=shopMessage[status];if(n)await notifyShop(o.shopId,n.title,n.message,'/app/suppliers?tab=orders',n.type,undefined,{
  experienceKey:status===SupplierOrderStatus.DELIVERED?'SHOP_ORDER_DELIVERED':'SHOP_ORDER_PROGRESS',
  eventId:o.id+'-'+status,metadata:{orderId:o.id,reference:o.reference,status}
}).catch(err=>console.error('Notification boutique état commande',err));
}
if(status===SupplierOrderStatus.READY_FOR_DELIVERY&&o.status!==SupplierOrderStatus.READY_FOR_DELIVERY){await prisma.supplierAuditEvent.create({data:{companyId:s.companyId,accountId:s.id,action:'DELIVERY_TICKET_ISSUED',entity:'SUPPLIER_ORDER',entityId:o.id,metadata:{reference:o.reference,deliveryCode:o.deliveryCode,itemCount:o.items.reduce((a,i)=>a+i.quantity,0),confirmedAt:new Date().toISOString()}}});await notifySupplier(s.companyId,'🚚 Nouvelle mission disponible',o.reference+' · commande prête pour '+o.items.reduce((a,i)=>a+i.quantity,0)+' article(s).',{href:'/delivery',kind:'DELIVERY',priority:'HIGH',experienceKey:'DRIVER_NEW_MISSION',eventId:o.id,roles:['DRIVER'],availableDriversOnly:true,metadata:{orderId:o.id,reference:o.reference,deliveryCodeRequired:true}});}
if(status===SupplierOrderStatus.DELIVERED)await ensureMarketplaceAccounting(id,s.id);
if(status===SupplierOrderStatus.CANCELLED)await Promise.allSettled(o.items.map(i=>notifySupplierLowStock(s.companyId,i.productId)));
return ok(plain(order))}catch(e:any){return bad(e.message,e.status||500)}}
