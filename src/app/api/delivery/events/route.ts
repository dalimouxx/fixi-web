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
  if(type==='ARRIVED_AT_SHOP'&&o.status!==SupplierOrderStatus.OUT_FOR_DELIVERY)
    return bad('Démarrez la livraison avant de signaler votre arrivée.',409);
  let amount:number|null=null;let dueCustomer:any=null;let dueSales:any[]=[];
  if(['COD_COLLECTED','DUE_COLLECTED'].includes(type)){const shift=await prisma.supplierDeliveryShift.findFirst({where:{companyId:s.companyId,driverAccountId:s.id,status:'OPEN'}});if(!shift)return bad('Ouvrez votre journée livreur avant tout encaissement.',409)}
  if(type==='COD_COLLECTED'){
   const n=Number(b.amount);if(!(n>0))return bad('Montant COD invalide');
   const prev=await prisma.supplierDeliveryEvent.aggregate({where:{companyId:s.companyId,orderId,type:'COD_COLLECTED'},_sum:{amount:true}});
   const total=Number(prev._sum.amount||0)+n;if(total>Number(o.total)+0.001)return bad('Le COD encaissé dépasse le montant de la commande',409);amount=n;
  }
  if(type==='DUE_COLLECTED'){
   const n=Number(b.amount);if(!(n>0))return bad('Montant du règlement invalide');
   dueCustomer=await prisma.supplierErpCustomer.findFirst({where:{companyId:s.companyId,shopId:o.shopId,active:true}});if(!dueCustomer)return bad('Aucune fiche client liée à cet atelier',404);
   const allSales=await prisma.supplierErpSale.findMany({where:{companyId:s.companyId,customerId:dueCustomer.id,status:{not:'CANCELLED'}},orderBy:{createdAt:'asc'}});
   dueSales=allSales.filter(x=>Number(x.total)-Number(x.paid)>0.0001);const due=dueSales.reduce((a,x)=>a+Math.max(0,Number(x.total)-Number(x.paid)),0);
   if(n>due+0.001)return bad('Le règlement dépasse le dû client ('+due.toFixed(3)+' DT)',409);amount=n;
  }
  const x=await prisma.$transaction(async tx=>{
   if(type==='ARRIVED_AT_SHOP'){
     const arrived=await tx.supplierDelivery.updateMany({
       where:{orderId,driverAccountId:s.id,arrivedAt:null},
       data:{arrivedAt:new Date()}
     });
     if(arrived.count!==1)return null;
   }
   const event=await tx.supplierDeliveryEvent.create({data:{companyId:s.companyId,orderId,accountId:s.id,type,note:b.note||null,amount:amount===null?null:Number(amount),latitude:Number.isFinite(Number(b.latitude))?Number(b.latitude):null,longitude:Number.isFinite(Number(b.longitude))?Number(b.longitude):null,proofUrl:b.proofUrl||null}});
   if(type==='COD_COLLECTED')await tx.supplierDelivery.update({where:{orderId},data:{cashCollected:{increment:Number(amount)}}});
   if(type==='DUE_COLLECTED'&&dueCustomer){let remaining=Number(amount||0);for(const sale of dueSales){if(remaining<=0.0001)break;const due=Math.max(0,Number(sale.total)-Number(sale.paid));const take=Math.min(remaining,due);if(take<=0)continue;const paid=Number(sale.paid)+take;await tx.supplierErpSale.update({where:{id:sale.id},data:{paid,status:paid+0.0001>=Number(sale.total)?'PAID':'PARTIALLY_PAID'}});await tx.supplierErpPayment.create({data:{companyId:s.companyId,customerId:dueCustomer.id,saleId:sale.id,kind:'IN',method:'CASH',amount:take,reference:sale.reference,note:'Ancien dû encaissé par livreur',accountId:s.id}});remaining-=take}}
   if(['CUSTOMER_ABSENT','DELIVERY_REFUSED','INCIDENT'].includes(type))await tx.supplierDelivery.update({where:{orderId},data:{attemptCount:{increment:1}}});
   if(type==='RETURN_TO_DEPOT'){
    await tx.supplierDelivery.update({where:{orderId},data:{status:SupplierDeliveryStatus.RETURNING,exceptionStatus:'RETURN_PENDING',returnNote:b.note||null}});
    await tx.supplierOrder.update({where:{id:orderId},data:{status:SupplierOrderStatus.RETURNING}});
   }
   return event;
  });
  if(type==='ARRIVED_AT_SHOP'&&!x)
    return ok({alreadyRecorded:true,message:'Arrivée déjà signalée'});
  const managers=['OWNER','ADMIN','MANAGER','DELIVERY_MANAGER'];
  if(type==='ARRIVED_AT_SHOP'){
    await Promise.allSettled([
      notifySupplier(s.companyId,'📍 Vous êtes arrivé',o.reference+' · '+o.shop.name+'. Votre arrivée est enregistrée.',{
        href:'/delivery',kind:'SUCCESS',priority:'NORMAL',
        experienceKey:'DRIVER_ARRIVED',eventId:orderId,accountIds:[s.id],
        metadata:{orderId,reference:o.reference,eventType:type}
      }),
      notifySupplier(s.companyId,'Livreur arrivé chez la boutique',s.fullName+' est arrivé pour '+o.reference+' · '+o.shop.name+'.',{
        href:'/supplier?tab=delivery',kind:'DELIVERY',
        experienceKey:'SUPPLIER_UPDATE',eventId:orderId+'-ARRIVED',
        roles:managers,metadata:{orderId,reference:o.reference,eventType:type}
      }),
      notifyShop(o.shopId,'📍 Votre livreur est arrivé',
        'Commande '+o.reference+' : '+s.fullName+' est arrivé. Préparez la réception et le code de remise.',
        '/app/suppliers?tab=orders',NotificationType.INFO,undefined,{
          experienceKey:'SHOP_ORDER_PROGRESS',eventId:orderId+'-ARRIVED',
          metadata:{orderId,reference:o.reference,status:'ARRIVED'}
        })
    ]);
  }
  if(type==='COD_COLLECTED'){
   await Promise.allSettled([
    notifySupplier(s.companyId,'COD encaissé',`${Number(amount||0).toFixed(3)} DT encaissé sur ${o.reference} · ${o.shop.name}`,{href:'/supplier?tab=delivery',kind:'PAYMENT',soundKey:'SUCCESS',roles:[...managers,'ACCOUNTANT'],metadata:{orderId:o.id,reference:o.reference,amount:Number(amount||0)}}),
    notifyShop(o.shopId,'Paiement livraison enregistré',`${Number(amount||0).toFixed(3)} DT a été enregistré sur la commande ${o.reference}.`,'/app/suppliers?tab=orders',NotificationType.PAYMENT)
   ]);
  }
  if(type==='DUE_COLLECTED'){
   await Promise.allSettled([
    notifySupplier(s.companyId,'Ancien dû encaissé',`${Number(amount||0).toFixed(3)} DT encaissé par ${s.fullName} chez ${o.shop.name}.`,{href:'/supplier?tab=dues',kind:'PAYMENT',soundKey:'SUCCESS',roles:[...managers,'ACCOUNTANT'],metadata:{orderId:o.id,shopId:o.shopId,amount:Number(amount||0),eventType:type}}),
    notifyShop(o.shopId,'Règlement de créance enregistré',`${Number(amount||0).toFixed(3)} DT a été déduit de votre solde fournisseur.`,'/app/suppliers?tab=orders',NotificationType.PAYMENT)
   ]);
  }
  const incidentLabels:Record<string,string>={
   CUSTOMER_ABSENT:'Client absent',
   DELIVERY_REFUSED:'Livraison refusée',
   INCIDENT:'Incident de livraison',
   RETURN_TO_DEPOT:'Retour vers fournisseur',
   RETURNED_TO_SUPPLIER:'Retour remis au fournisseur',
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
