import {prisma} from '@/lib/prisma';
import {requireDeliverySession} from '@/lib/delivery-auth';
import {bad,ok} from '@/lib/http';
import {plain} from '@/lib/serializers';

export async function GET(){
 try{
  const s=await requireDeliverySession();
  const [current,pendingCashier,recent]=await Promise.all([
   prisma.supplierDeliveryShift.findFirst({where:{companyId:s.companyId,driverAccountId:s.id,status:'OPEN'},orderBy:{openedAt:'desc'}}),
   prisma.supplierDeliveryShift.findFirst({where:{companyId:s.companyId,driverAccountId:s.id,status:'PENDING_CASHIER'},orderBy:{submittedAt:'desc'}}),
   prisma.supplierDeliveryShift.findMany({where:{companyId:s.companyId,driverAccountId:s.id},orderBy:{openedAt:'desc'},take:15})
  ]);
  return ok(plain({current,pendingCashier,recent}));
 }catch(e:any){return bad(e.message,e.status||500)}
}

export async function POST(req:Request){
 try{
  const s=await requireDeliverySession();const b=await req.json();const action=String(b.action||'');
  if(action==='OPEN'){
   const exists=await prisma.supplierDeliveryShift.findFirst({where:{companyId:s.companyId,driverAccountId:s.id,status:{in:['OPEN','PENDING_CASHIER']}}});
   if(exists)return bad(exists.status==='PENDING_CASHIER'?'Votre remise caisse précédente doit être confirmée par le caissier.':'Votre journée est déjà ouverte',409);
   const cash=Number(b.startCash??0),mileage=b.startMileage==null||b.startMileage===''?null:Number(b.startMileage);
   if(!Number.isFinite(cash)||cash<0||cash>100000000)return bad('Fond de caisse invalide',400);
   if(mileage!==null&&(!Number.isSafeInteger(mileage)||mileage<0))return bad('Kilométrage invalide',400);
   const x=await prisma.supplierDeliveryShift.create({data:{
     companyId:s.companyId,driverAccountId:s.id,startCash:cash,startMileage:mileage,
     note:String(b.note||'').slice(0,1000)||null
   }});
   // Logging a secondary event must never turn a successfully opened day into a client-visible failure.
   await prisma.supplierDeliveryEvent.create({data:{
     companyId:s.companyId,orderId:'SHIFT:'+x.id,accountId:s.id,
     type:'SHIFT_OPENED',note:String(b.note||'').slice(0,1000)||null
   }}).catch(error=>console.error('Delivery shift opening audit event failed',error));
   return ok(plain(x),{status:201});
  }
  if(action==='CLOSE'){
   const x=await prisma.supplierDeliveryShift.findFirst({where:{companyId:s.companyId,driverAccountId:s.id,status:'OPEN'},orderBy:{openedAt:'desc'}});if(!x)return bad('Aucune journée ouverte',404);
   const active=await prisma.supplierOrder.count({where:{companyId:s.companyId,delivery:{is:{driverAccountId:s.id}},status:{in:['OUT_FOR_DELIVERY','RETURNING'] as any}}});if(active>0)return bad('Terminez ou retournez toutes les livraisons actives avant la remise caisse.',409);
   const cod=await prisma.supplierDeliveryEvent.aggregate({where:{companyId:s.companyId,accountId:s.id,type:{in:['COD_COLLECTED','DUE_COLLECTED']},createdAt:{gte:x.openedAt}},_sum:{amount:true}});
   const collected=Number(cod._sum.amount||0),declared=Math.max(0,Number(b.remittedCod||0));
   const endMileage=b.endMileage==null||b.endMileage===''?null:Number(b.endMileage);
   if(endMileage!==null&&(!Number.isSafeInteger(endMileage)||endMileage<0))return bad('Kilométrage de fin invalide',400);
   if(!Number.isFinite(Number(b.remittedCod))||Number(b.remittedCod)<0)return bad('Remise caisse invalide',400);if(endMileage!==null&&x.startMileage!==null&&endMileage<x.startMileage)return bad('Kilométrage de fin invalide',409);
   const updated=await prisma.supplierDeliveryShift.update({where:{id:x.id},data:{status:'PENDING_CASHIER',collectedCod:collected,expectedCod:collected,declaredRemit:declared,endMileage,submittedAt:new Date(),note:b.note||x.note}});
   const auditResults=await Promise.allSettled([
     prisma.supplierDeliveryEvent.create({data:{companyId:s.companyId,orderId:'SHIFT:'+x.id,accountId:s.id,type:'CASH_REMIT_SUBMITTED',amount:declared,note:'Attendu '+collected.toFixed(3)+' DT · déclaré '+declared.toFixed(3)+' DT'}}),
     prisma.supplierAuditEvent.create({data:{companyId:s.companyId,accountId:s.id,action:'DRIVER_CASH_SUBMIT',entity:'DELIVERY_SHIFT',entityId:x.id,metadata:{expected:collected,declared,endMileage}}})
   ]);
   if(auditResults.some(x=>x.status==='rejected'))
     console.error('Delivery cash handover audit event failed',auditResults.filter(x=>x.status==='rejected'));
   return ok(plain(updated));
  }
  return bad('Action journée inconnue');
 }catch(e:any){return bad(e.message,e.status||500)}
}
