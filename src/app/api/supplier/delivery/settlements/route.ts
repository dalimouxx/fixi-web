import {prisma} from '@/lib/prisma';
import {requireSupplierRole} from '@/lib/supplier-auth';
import {bad,ok} from '@/lib/http';
import {plain} from '@/lib/serializers';

export async function GET(){
 try{
  const s=await requireSupplierRole(['OWNER','ADMIN','MANAGER','CASHIER','ACCOUNTANT','DELIVERY_MANAGER']);
  const shifts=await prisma.supplierDeliveryShift.findMany({where:{companyId:s.companyId,status:{in:['PENDING_CASHIER','CLOSED']}},orderBy:{submittedAt:'desc'},take:100});
  const drivers=await prisma.supplierAccount.findMany({where:{companyId:s.companyId,role:'DRIVER'},select:{id:true,fullName:true,phone:true,login:true,isActive:true}});
  const ids=shifts.map(x=>x.id),driverIds=[...new Set(shifts.map(x=>x.driverAccountId))];
  const events=ids.length?await prisma.supplierDeliveryEvent.findMany({where:{companyId:s.companyId,OR:ids.map(id=>({orderId:'SHIFT:'+id}))},orderBy:{createdAt:'desc'}}):[];
  const deliveryEvents=driverIds.length?await prisma.supplierDeliveryEvent.findMany({where:{companyId:s.companyId,accountId:{in:driverIds},type:{in:['COD_COLLECTED','DUE_COLLECTED']},createdAt:{gte:new Date(Date.now()-7*86400000)}},orderBy:{createdAt:'desc'},take:1000}):[];
  const driverMap=new Map(drivers.map(d=>[d.id,d]));
  return ok(plain(shifts.map(x=>({...x,driver:driverMap.get(x.driverAccountId)||null,events:events.filter(e=>e.orderId==='SHIFT:'+x.id),collections:deliveryEvents.filter(e=>e.accountId===x.driverAccountId&&e.createdAt>=x.openedAt&&(!x.submittedAt||e.createdAt<=x.submittedAt))}))));
 }catch(e:any){return bad(e.message,e.status||500)}
}

export async function POST(req:Request){
 try{
  const s=await requireSupplierRole(['OWNER','ADMIN','MANAGER','CASHIER']);
  const b=await req.json(),shiftId=String(b.shiftId||'');
  const shift=await prisma.supplierDeliveryShift.findFirst({where:{id:shiftId,companyId:s.companyId,status:'PENDING_CASHIER'}});if(!shift)return bad('Remise caisse introuvable ou déjà traitée',404);
  const cashSession=await prisma.supplierErpCashSession.findFirst({where:{companyId:s.companyId,accountId:s.id,status:'OPEN'},orderBy:{openedAt:'desc'}});if(!cashSession)return bad('Ouvrez votre session de caisse avant de confirmer la remise livreur.',409);
  const actual=Math.round(Math.max(0,Number(b.actualAmount||0))*1000)/1000;
  const expected=Number(shift.expectedCod||shift.collectedCod||0),difference=Math.round((actual-expected)*1000)/1000;
  if(Math.abs(difference)>=.001&&!String(b.note||'').trim())return bad('Un écart de recette exige une justification écrite',400);
  const submittedAt=shift.submittedAt||new Date();
  const result=await prisma.$transaction(async tx=>{
   const changed=await tx.supplierDeliveryShift.updateMany({
    where:{id:shift.id,companyId:s.companyId,status:'PENDING_CASHIER'},
    data:{status:'CLOSED',remittedCod:actual,cashDifference:difference,cashierAccountId:s.id,confirmedAt:new Date(),closedAt:new Date(),note:b.note?String(b.note).slice(0,500):shift.note}
   });
   if(changed.count!==1)throw Object.assign(new Error('Remise déjà clôturée sur une autre caisse : actualisez'),{status:409});
   const updated=await tx.supplierDeliveryShift.findUniqueOrThrow({where:{id:shift.id}});
   await tx.supplierErpPayment.updateMany({where:{companyId:s.companyId,accountId:shift.driverAccountId,cashSessionId:null,kind:'IN',createdAt:{gte:shift.openedAt,lte:submittedAt}},data:{cashSessionId:cashSession.id}});
   await tx.supplierDeliveryEvent.create({data:{companyId:s.companyId,orderId:'SHIFT:'+shift.id,accountId:s.id,type:'CASH_REMIT_CONFIRMED',amount:actual,note:'Attendu '+expected.toFixed(3)+' DT · reçu '+actual.toFixed(3)+' DT · écart '+difference.toFixed(3)+' DT'}});
   await tx.supplierAuditEvent.create({data:{companyId:s.companyId,accountId:s.id,action:'DRIVER_CASH_CONFIRM',entity:'DELIVERY_SHIFT',entityId:shift.id,metadata:{driverAccountId:shift.driverAccountId,expected,declared:Number(shift.declaredRemit||0),actual,difference,cashSessionId:cashSession.id,note:b.note||null}}});
   return updated;
  });
  return ok(plain(result));
 }catch(e:any){return bad(e.message,e.status||500)}
}
