import { prisma } from '@/lib/prisma';
import { requirePlatformSession } from '@/lib/platform-auth';
import { bad, ok } from '@/lib/http';
import { SubscriptionStatus } from '@prisma/client';
import { plain } from '@/lib/serializers';

export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  await requirePlatformSession();
  const {id}=await params,b=await req.json();
  if(b.status&&!Object.values(SubscriptionStatus).includes(b.status))return bad('Statut invalide',400);
  const current=await prisma.subscription.findUnique({where:{id},include:{plan:true}});
  if(!current)return bad('Abonnement introuvable',404);
  const selected=b.planId?await prisma.plan.findUnique({where:{id:String(b.planId)}}):null;
  if(b.planId&&!selected)return bad('Plan introuvable',404);
  const free=(selected||current.plan).code==='CONNECT';
  const startsAt=b.startsAt===undefined?current.startsAt:new Date(b.startsAt);
  const endsAt=free?null:b.endsAt===undefined?current.endsAt:
    b.endsAt===null||b.endsAt===''?null:new Date(b.endsAt);
  if(!Number.isFinite(startsAt.getTime())||endsAt&&!Number.isFinite(endsAt.getTime()))
    return bad('Date invalide',400);
  if(endsAt&&endsAt<=startsAt)return bad('La fin doit être postérieure au début',400);
  const agreedPrice=free?0:b.agreedPrice===undefined?undefined:Number(b.agreedPrice);
  if(agreedPrice!==undefined&&(!Number.isFinite(agreedPrice)||agreedPrice<0||agreedPrice>10000000))return bad('Prix négocié invalide',400);
  const updated=await prisma.subscription.update({where:{id},data:{
    status:free?SubscriptionStatus.ACTIVE:b.status||undefined,
    planId:selected?.id,
    agreedPrice,
    startsAt:b.startsAt!==undefined?startsAt:undefined,
    endsAt,
    notes:b.notes===undefined?undefined:String(b.notes||'').slice(0,1500),
  }});
  return ok(plain(updated));
 }catch(e:any){return bad(e.message,e.status||500)}
}

export async function DELETE(_:Request,{params}:{params:Promise<{id:string}>}){
 try{
  await requirePlatformSession();
  const {id}=await params;
  const current=await prisma.subscription.findUnique({where:{id}});
  if(!current)return bad('Abonnement introuvable',404);
  // A subscription linked to financial history must never be destructively removed.
  const [payments,invoices]=await Promise.all([
   prisma.saasPayment.count({where:{tenantId:current.tenantId,paidAt:{gte:current.startsAt}}}),
   prisma.saasInvoice.count({where:{tenantId:current.tenantId,issuedAt:{gte:current.startsAt}}}),
  ]);
  if(current.status==='TRIAL'&&payments===0&&invoices===0){
    await prisma.subscription.delete({where:{id}});
    return ok({deleted:true,archived:false});
  }
  await prisma.subscription.update({where:{id},data:{status:'CANCELLED',
    notes:(current.notes||'')+'\nArchivage demandé dans Fixi Admin'}});
  return ok({deleted:false,archived:true,message:'Période archivée pour préserver les paiements et factures.'});
 }catch(e:any){return bad(e.message,e.status||500)}
}
