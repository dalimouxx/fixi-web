import {prisma} from '@/lib/prisma';
import {ensureMarketplaceAccounting} from '@/lib/supplier-accounting';
import {requireDeliverySession} from '@/lib/delivery-auth';
import {bad,ok} from '@/lib/http';
import {plain} from '@/lib/serializers';
import {NotificationType,SupplierDeliveryStatus,SupplierOrderStatus} from '@prisma/client';
import {notifySupplier} from '@/lib/supplier-notifications';
import {notifyShop} from '@/lib/notifications';

export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const s=await requireDeliverySession();const{id}=await params;const b=await req.json();
  const o=await prisma.supplierOrder.findFirst({where:{id,companyId:s.companyId,delivery:{is:{driverAccountId:s.id}}},include:{delivery:true}});
  if(!o)return bad('Livraison introuvable',404);
  const status=String(b.status||o.status) as SupplierOrderStatus;
  const allowed:SupplierOrderStatus[]=[SupplierOrderStatus.READY_FOR_DELIVERY,SupplierOrderStatus.OUT_FOR_DELIVERY,SupplierOrderStatus.DELIVERED];
  if(!allowed.includes(status))return bad('Statut invalide');
  if(status===SupplierOrderStatus.OUT_FOR_DELIVERY){
   if(o.status!==SupplierOrderStatus.READY_FOR_DELIVERY&&o.status!==SupplierOrderStatus.OUT_FOR_DELIVERY)return bad('Transition invalide',409);
   const shift=await prisma.supplierDeliveryShift.findFirst({where:{companyId:s.companyId,driverAccountId:s.id,status:'OPEN'}});
   if(!shift)return bad('Ouvrez votre journée avant de démarrer une livraison',409);
  }
  if(status===SupplierOrderStatus.DELIVERED){
   if(o.status!==SupplierOrderStatus.OUT_FOR_DELIVERY)return bad('La livraison doit être en route',409);
   if(!String(b.recipientName||'').trim())return bad('Nom du réceptionnaire requis pour confirmer la livraison',409);
   if(!o.deliveryCode||String(b.proofCode||'').trim()!==String(o.deliveryCode))return bad('Code de remise atelier invalide',409);
  }
  const ds=status===SupplierOrderStatus.DELIVERED?SupplierDeliveryStatus.DELIVERED:status===SupplierOrderStatus.OUT_FOR_DELIVERY?SupplierDeliveryStatus.OUT_FOR_DELIVERY:SupplierDeliveryStatus.ASSIGNED;
  const result=await prisma.$transaction(async tx=>{
   const order=await tx.supplierOrder.update({where:{id},data:{status}});
   await tx.supplierDelivery.update({where:{orderId:id},data:{
    status:ds,
    pickedUpAt:status===SupplierOrderStatus.OUT_FOR_DELIVERY&&!o.delivery?.pickedUpAt?new Date():undefined,
    deliveredAt:status===SupplierOrderStatus.DELIVERED?new Date():undefined,
    trackingNote:b.trackingNote||undefined,
    recipientName:status===SupplierOrderStatus.DELIVERED?String(b.recipientName).trim():undefined,
    recipientPhone:status===SupplierOrderStatus.DELIVERED?(String(b.recipientPhone||'').trim()||null):undefined,
    proofCode:status===SupplierOrderStatus.DELIVERED?(String(b.proofCode||'').trim()||null):undefined,
    proofUrl:status===SupplierOrderStatus.DELIVERED?(b.proofUrl||undefined):undefined
   }});
   if(status===SupplierOrderStatus.DELIVERED)await tx.supplierDeliveryEvent.create({data:{companyId:s.companyId,orderId:id,accountId:s.id,type:'DELIVERY_PROOF',note:'Reçu par '+String(b.recipientName).trim()+(b.proofCode?' · Code '+String(b.proofCode):''),proofUrl:b.proofUrl||null}});
   if(Number.isFinite(Number(b.latitude))&&Number.isFinite(Number(b.longitude)))await tx.supplierDriverLocation.create({data:{companyId:s.companyId,orderId:id,accountId:s.id,latitude:Number(b.latitude),longitude:Number(b.longitude),accuracy:Number.isFinite(Number(b.accuracy))?Number(b.accuracy):null}});
   return order;
  });
  if(status===SupplierOrderStatus.DELIVERED)await ensureMarketplaceAccounting(id,s.id);
  if(status!==o.status){
   if(status===SupplierOrderStatus.OUT_FOR_DELIVERY){
    await Promise.allSettled([
     notifySupplier(s.companyId,'Livraison démarrée',`La commande ${o.reference} est maintenant en route.`,{href:'/supplier?tab=delivery',kind:'DELIVERY',roles:['OWNER','ADMIN','MANAGER','DELIVERY_MANAGER'],metadata:{orderId:o.id,reference:o.reference}}),
     notifyShop(o.shopId,'Votre commande est en route',`La commande ${o.reference} est partie en livraison. Vous pouvez suivre son avancement dans Fixi Supplier.`,'/app/suppliers',NotificationType.INFO)
    ]);
   }
   if(status===SupplierOrderStatus.DELIVERED){
    await Promise.allSettled([
     notifySupplier(s.companyId,'Livraison confirmée',`Commande ${o.reference} remise à ${String(b.recipientName).trim()}.`,{href:'/supplier?tab=delivery',kind:'SUCCESS',priority:'NORMAL',soundKey:'SUCCESS',roles:['OWNER','ADMIN','MANAGER','DELIVERY_MANAGER','ACCOUNTANT'],metadata:{orderId:o.id,reference:o.reference,recipientName:String(b.recipientName).trim()}}),
     notifyShop(o.shopId,'Commande livrée',`La commande ${o.reference} a été remise à ${String(b.recipientName).trim()}.`,'/app/suppliers',NotificationType.SUCCESS)
    ]);
   }
  }
  return ok(plain(result));
 }catch(e:any){return bad(e.message,e.status||500)}
}


export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const s=await requireDeliverySession();const{id}=await params;
  const o=await prisma.supplierOrder.findFirst({where:{id,companyId:s.companyId,status:SupplierOrderStatus.READY_FOR_DELIVERY},include:{delivery:true,shop:{select:{name:true}}}});
  if(!o)return bad('Commande indisponible',404);
  if(o.delivery?.driverAccountId===s.id)return ok(plain(o));
  if(o.delivery?.driverAccountId)return bad('Cette commande vient d’être acceptée par un autre livreur',409);
  const result=await prisma.$transaction(async tx=>{
   const updated=await tx.supplierDelivery.updateMany({where:{orderId:id,driverAccountId:null},data:{driverAccountId:s.id,driverName:s.fullName,assignedAt:new Date(),acceptedAt:new Date(),status:SupplierDeliveryStatus.ASSIGNED}});
   if(updated.count!==1)throw Object.assign(new Error('Commande déjà prise'),{status:409});
   await tx.supplierDeliveryEvent.create({data:{companyId:s.companyId,orderId:id,accountId:s.id,type:'DELIVERY_ACCEPTED',note:'Commande acceptée par '+s.fullName}});
   return tx.supplierOrder.findUnique({where:{id},include:{delivery:true,shop:{select:{name:true,region:true,address:true,phone:true}},items:{include:{product:true}}}});
  });
  await Promise.allSettled([
   notifySupplier(s.companyId,'Commande prise par un livreur',o.reference+' · '+s.fullName+' a accepté la livraison.',{href:'/supplier?tab=delivery',kind:'DELIVERY',soundKey:'SUCCESS',roles:['OWNER','ADMIN','MANAGER','DELIVERY_MANAGER'],metadata:{orderId:id,reference:o.reference,driverAccountId:s.id}}),
   notifyShop(o.shopId,'Livreur affecté',o.reference+' · '+s.fullName+' a accepté votre livraison.','/app/suppliers',NotificationType.INFO)
  ]);
  return ok(plain(result));
 }catch(e:any){return bad(e.message,e.status||500)}
}
