import {prisma} from '@/lib/prisma';
import {requireSupplierRole} from '@/lib/supplier-auth';
import {bad,ok} from '@/lib/http';
import {plain} from '@/lib/serializers';
import {SupplierDeliveryStatus,SupplierOrderStatus} from '@prisma/client';
import {notifySupplier} from '@/lib/supplier-notifications';
import {notifyShop} from '@/lib/notifications';
import {NotificationType} from '@prisma/client';

export async function GET(){
 try{
  const s=await requireSupplierRole(['OWNER','ADMIN','MANAGER','DELIVERY_MANAGER','STOCK']);
  const rows=await prisma.supplierOrder.findMany({
   where:{companyId:s.companyId,status:{in:[SupplierOrderStatus.RETURNING,SupplierOrderStatus.RETURNED]}},
   include:{shop:{select:{name:true,phone:true,address:true,region:true}},items:{include:{product:true}},delivery:true},
   orderBy:{updatedAt:'desc'},take:200
  });
  return ok(plain(rows));
 }catch(e:any){return bad(e.message,e.status||500)}
}

export async function POST(req:Request){
 try{
  const s=await requireSupplierRole(['OWNER','ADMIN','MANAGER','DELIVERY_MANAGER','STOCK']);
  const b=await req.json(),orderId=String(b.orderId||''),action=String(b.action||'');
  const order=await prisma.supplierOrder.findFirst({where:{id:orderId,companyId:s.companyId,status:SupplierOrderStatus.RETURNED},include:{items:{include:{product:true}},delivery:true,shop:true}});
  if(!order)return bad('Retour fournisseur introuvable ou non réceptionné',404);
  if(order.delivery?.exceptionStatus?.startsWith('RESOLVED_'))return bad('Ce retour est déjà traité',409);
  const ref='RET-LIV-'+Date.now().toString(36).toUpperCase();
  if(action==='RESTOCK'||action==='DAMAGED'){
   const restock=action==='RESTOCK';
   const allocations=await prisma.supplierOrderStockAllocation.findMany({where:{orderId}});
   await prisma.$transaction(async tx=>{
    const ret=await tx.supplierReturn.create({data:{companyId:s.companyId,type:'DELIVERY_RETURN',reference:ref,sourceRef:order.reference,status:'COMPLETED',total:order.total,refund:0,note:b.note||order.delivery?.returnNote||null,createdById:s.id,completedAt:new Date()}});
    for(const item of order.items){
     await tx.supplierReturnItem.create({data:{returnId:ret.id,productId:item.productId,sku:item.product.sku,name:item.product.name,quantity:item.quantity,unitCost:Number(item.product.averageCost||item.product.purchasePrice||0),unitPrice:item.unitPrice,reason:b.note||order.delivery?.returnNote||'Retour livraison',condition:restock?'GOOD':'DAMAGED',restock}});
     if(restock)await tx.supplierProduct.update({where:{id:item.productId},data:{stock:{increment:item.quantity}}});
    }
    if(restock)for(const a of allocations)if(a.warehouseId)await tx.supplierWarehouseStock.upsert({where:{warehouseId_productId:{warehouseId:a.warehouseId,productId:a.productId}},update:{quantity:{increment:a.quantity}},create:{companyId:s.companyId,warehouseId:a.warehouseId,productId:a.productId,quantity:a.quantity}});
    await tx.supplierDelivery.update({where:{orderId},data:{exceptionStatus:restock?'RESOLVED_RESTOCK':'RESOLVED_DAMAGED',returnCondition:restock?'GOOD':'DAMAGED',returnNote:b.note||order.delivery?.returnNote||null}});
    await tx.supplierOrder.update({where:{id:orderId},data:{status:SupplierOrderStatus.CANCELLED}});
    await tx.supplierAuditEvent.create({data:{companyId:s.companyId,accountId:s.id,action:restock?'RETURN_RESTOCK':'RETURN_DAMAGED',entity:'SUPPLIER_ORDER',entityId:orderId,metadata:{reference:order.reference,returnRef:ref,note:b.note||null}}});
   });
   await notifyShop(order.shopId,restock?'Retour fournisseur clôturé':'Retour classé endommagé','La commande '+order.reference+' a été clôturée après retour fournisseur.','/app/suppliers',NotificationType.INFO);
   return ok({ok:true,status:restock?'RESTOCKED':'DAMAGED'});
  }
  if(action==='REDELIVER'){
   await prisma.$transaction([
    prisma.supplierOrder.update({where:{id:orderId},data:{status:SupplierOrderStatus.READY_FOR_DELIVERY}}),
    prisma.supplierDelivery.update({where:{orderId},data:{status:SupplierDeliveryStatus.PENDING,driverAccountId:null,driverName:null,driverPhone:null,assignedAt:null,acceptedAt:null,pickedUpAt:null,exceptionStatus:null,returnCondition:null}})
   ]);
   await notifySupplier(s.companyId,'Livraison à reprendre',order.reference+' est de nouveau disponible aux livreurs.',{href:'/delivery',kind:'DELIVERY',priority:'HIGH',roles:['DRIVER'],availableDriversOnly:true,metadata:{orderId,reference:order.reference}});
   return ok({ok:true,status:'READY_FOR_DELIVERY'});
  }
  return bad('Décision de retour inconnue');
 }catch(e:any){return bad(e.message,e.status||500)}
}
