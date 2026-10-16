import {prisma} from '@/lib/prisma';
import {requireDeliverySession} from '@/lib/delivery-auth';
import {bad,ok} from '@/lib/http';
import {plain} from '@/lib/serializers';

export async function GET(){
 try{
  const s=await requireDeliverySession();
  const [current,recent]=await Promise.all([
   prisma.supplierDeliveryShift.findFirst({where:{companyId:s.companyId,driverAccountId:s.id,status:'OPEN'},orderBy:{openedAt:'desc'}}),
   prisma.supplierDeliveryShift.findMany({where:{companyId:s.companyId,driverAccountId:s.id},orderBy:{openedAt:'desc'},take:15})
  ]);
  return ok(plain({current,recent}));
 }catch(e:any){return bad(e.message,e.status||500)}
}

export async function POST(req:Request){
 try{
  const s=await requireDeliverySession();const b=await req.json();const action=String(b.action||'');
  if(action==='OPEN'){
   const exists=await prisma.supplierDeliveryShift.findFirst({where:{companyId:s.companyId,driverAccountId:s.id,status:'OPEN'}});
   if(exists)return bad('Votre journée est déjà ouverte',409);
   const x=await prisma.supplierDeliveryShift.create({data:{companyId:s.companyId,driverAccountId:s.id,startCash:Math.max(0,Number(b.startCash||0)),startMileage:Number.isFinite(Number(b.startMileage))?Math.max(0,Math.trunc(Number(b.startMileage))):null,note:b.note||null}});
   await prisma.supplierDeliveryEvent.create({data:{companyId:s.companyId,orderId:'SHIFT:'+x.id,accountId:s.id,type:'SHIFT_OPENED',note:b.note||null}});
   return ok(plain(x),{status:201});
  }
  if(action==='CLOSE'){
   const x=await prisma.supplierDeliveryShift.findFirst({where:{companyId:s.companyId,driverAccountId:s.id,status:'OPEN'},orderBy:{openedAt:'desc'}});if(!x)return bad('Aucune journée ouverte',404);
   const cod=await prisma.supplierDeliveryEvent.aggregate({where:{companyId:s.companyId,accountId:s.id,type:'COD_COLLECTED',createdAt:{gte:x.openedAt}},_sum:{amount:true}});
   const collected=Number(cod._sum.amount||0),remitted=Math.max(0,Number(b.remittedCod||0));if(remitted>collected+0.001)return bad('Remise COD supérieure au montant encaissé',409);
   const endMileage=Number.isFinite(Number(b.endMileage))?Math.max(0,Math.trunc(Number(b.endMileage))):null;if(endMileage!==null&&x.startMileage!==null&&endMileage<x.startMileage)return bad('Kilométrage de fin invalide',409);
   const updated=await prisma.supplierDeliveryShift.update({where:{id:x.id},data:{status:'CLOSED',collectedCod:collected,remittedCod:remitted,endMileage,closedAt:new Date(),note:b.note||x.note}});
   await prisma.supplierDeliveryEvent.create({data:{companyId:s.companyId,orderId:'SHIFT:'+x.id,accountId:s.id,type:'SHIFT_CLOSED',amount:remitted,note:'COD encaissé '+collected.toFixed(3)}});
   return ok(plain(updated));
  }
  return bad('Action journée inconnue');
 }catch(e:any){return bad(e.message,e.status||500)}
}
