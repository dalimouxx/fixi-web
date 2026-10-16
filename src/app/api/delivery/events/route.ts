import {prisma} from '@/lib/prisma';
import {requireDeliverySession} from '@/lib/delivery-auth';
import {bad,ok} from '@/lib/http';
import {plain} from '@/lib/serializers';
import {NotificationType,SupplierDeliveryStatus,SupplierOrderStatus} from '@prisma/client';
import {notifySupplier} from '@/lib/supplier-notifications';
import {notifyShop} from '@/lib/notifications';

export async function POST(req:Request){
 try{
  const s=await requireDeliverySession();const b=await req.json();const orderId=String(b.orderId||''),type=String(b.type||'NOTE');
  const o=await prisma.supplierOrder.findFirst({where:{id:orderId,companyId:s.companyId,delivery:{is:{driverAccountId:s.id}}},include:{delivery:true,shop:{select:{name:true}}}});
  if(!o)return bad('Livraison introuvable',404);
  let amount:number|null=null;
  if(type==='COD_COLLECTED'){
   const n=Number(b.amount);if(!(n>0))return bad('Montant COD invalide');
   const prev=await prisma.supplierDeliveryEvent.aggregate({where:{companyId:s.companyId,orderId,type:'COD_COLLECTED'},_sum:{amount:true}});
   const total=Number(prev._sum.amount||0)+n;if(total>Number(o.total)+0.001)return bad('Le COD encaissé dépasse le montant de la commande',409);amount=n;
  }
  const x=await prisma.$transaction(async tx=>{
   const event=await tx.supplierDeliveryEvent.create({data:{companyId:s.companyId,orderId,accountId:s.id,type,note:b.note||null,amount:amount===null?(Number.isFinite(Number(b.amount))?Number(b.amount):null):Number(amount),latitude:Number.isFinite(Number(b.latitude))?Number(b.latitude):null,longitude:Number.isFinite(Number(b.longitude))?Number(b.longitude):null,proofUrl:b.proofUrl||null}});
   if(type==='COD_COLLECTED')await tx.supplierDelivery.update({where:{orderId},data:{cashCollected:{increment:Number(amount)}}});
   if(['CUSTOMER_ABSENT','DELIVERY_REFUSED','INCIDENT'].includes(type))await tx.supplierDelivery.update({where:{orderId},data:{attemptCount:{increment:1}}});
   if(type==='RETURN_TO_DEPOT'){
    await tx.supplierDelivery.update({where:{orderId},data:{status:SupplierDeliveryStatus.FAILED}});
    await tx.supplierOrder.update({where:{id:orderId},data:{status:SupplierOrderStatus.READY_FOR_DELIVERY}});
   }
   return event;
  });
  const managers=['OWNER','ADMIN','MANAGER','DELIVERY_MANAGER'];
  if(type==='COD_COLLECTED'){
   await Promise.allSettled([
    notifySupplier(s.companyId,'COD encaissé',`${Number(amount||0).toFixed(3)} DT encaissé sur ${o.reference} · ${o.shop.name}`,{href:'/supplier?tab=delivery',kind:'PAYMENT',soundKey:'SUCCESS',roles:[...managers,'ACCOUNTANT'],metadata:{orderId:o.id,reference:o.reference,amount:Number(amount||0)}}),
    notifyShop(o.shopId,'Paiement livraison enregistré',`${Number(amount||0).toFixed(3)} DT a été enregistré sur la commande ${o.reference}.`,'/app/suppliers',NotificationType.PAYMENT)
   ]);
  }
  const incidentLabels:Record<string,string>={
   CUSTOMER_ABSENT:'Client absent',
   DELIVERY_REFUSED:'Livraison refusée',
   INCIDENT:'Incident de livraison',
   RETURN_TO_DEPOT:'Retour au dépôt',
   RESCHEDULED:'Livraison reprogrammée'
  };
  if(incidentLabels[type]){
   const urgent=['DELIVERY_REFUSED','INCIDENT','RETURN_TO_DEPOT'].includes(type);
   await Promise.allSettled([
    notifySupplier(s.companyId,incidentLabels[type],`${o.reference} · ${o.shop.name}${b.note?' · '+String(b.note):''}`,{href:'/supplier?tab=delivery',kind:urgent?'WARNING':'DELIVERY',priority:urgent?'URGENT':'HIGH',soundKey:urgent?'URGENT':'WARNING',roles:managers,metadata:{orderId:o.id,reference:o.reference,eventType:type}}),
    notifyShop(o.shopId,incidentLabels[type],`Commande ${o.reference}${b.note?' · '+String(b.note):''}`,'/app/suppliers',urgent?NotificationType.WARNING:NotificationType.INFO)
   ]);
  }
  return ok(plain(x),{status:201});
 }catch(e:any){return bad(e.message,e.status||500)}
}
export async function GET(){
 try{const s=await requireDeliverySession();const rows=await prisma.supplierDeliveryEvent.findMany({where:{companyId:s.companyId,accountId:s.id},orderBy:{createdAt:'desc'},take:1000});return ok(plain(rows))}
 catch(e:any){return bad(e.message,e.status||500)}
}
