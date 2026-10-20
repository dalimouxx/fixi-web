import {prisma} from '@/lib/prisma';
import {requirePlatformSession} from '@/lib/platform-auth';
import {bad,ok} from '@/lib/http';
import {plain} from '@/lib/serializers';
import {addDuration} from '@/lib/subscription-duration';
import {SubscriptionStatus} from '@prisma/client';
import crypto from 'node:crypto';

export const dynamic='force-dynamic';
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
 try{
  await requirePlatformSession();
  const {id}=await params;
  const request=await prisma.supplierSubscriptionRequest.findUnique({where:{id}});
  if(!request)return bad('Demande introuvable',404);
  return ok(plain(request));
 }catch(e:any){return bad(e.message,e.status||500)}
}
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const admin=await requirePlatformSession();
  const {id}=await params,b=await req.json();
  const action=String(b.action||'');
  if(!['APPROVE','REJECT'].includes(action))return bad('Action invalide',400);
  const current=await prisma.supplierSubscriptionRequest.findUnique({where:{id}});
  if(!current)return bad('Demande introuvable',404);
  if(current.status!=='PENDING')return bad('Cette demande est déjà traitée',409);
  const note=String(b.adminNote||'').trim().slice(0,1000)||null;
  if(action==='REJECT'){
    if(!note)return bad('Indiquez le motif du rejet',400);
    const updated=await prisma.supplierSubscriptionRequest.updateMany({
      where:{id,status:'PENDING'},data:{
        status:'REJECTED',reviewedAt:new Date(),reviewedById:admin.id,adminNote:note
      }
    });
    return updated.count?ok({status:'REJECTED'}):bad('Demande déjà traitée',409);
  }
  if(b.verified!==true)return bad('Confirmez avoir vérifié réellement le virement ou l’encaissement',400);
  const plan=await prisma.supplierSaasPlan.findUnique({where:{id:current.planId}});
  if(!plan||!plan.active)return bad('Formule indisponible',409);
  const paid=Number(b.verifiedAmount);
  if(!Number.isFinite(paid)||paid<=0||paid>10000000)return bad('Montant réellement reçu invalide',400);
  const transferReference=String(b.transferReference||current.transferReference||'').trim().slice(0,100);
  if(!transferReference&&!note)return bad('Indiquez une référence bancaire ou une note de rapprochement',400);
  const agreedPrice=b.agreedPrice===undefined?Number(current.requestedPrice):Number(b.agreedPrice);
  if(!Number.isFinite(agreedPrice)||agreedPrice<=0||agreedPrice>10000000)return bad('Prix convenu invalide',400);
  if(paid<agreedPrice-0.001)return bad('Montant vérifié inférieur au prix convenu : un règlement partiel ne peut pas activer la période',409);
  const now=new Date();
  const endsAt=addDuration(now,current.durationValue,current.durationUnit);
  const result=await prisma.$transaction(async tx=>{
    const lock=await tx.supplierSubscriptionRequest.updateMany({
      where:{id,status:'PENDING'},data:{status:'PROCESSING'}
    });
    if(!lock.count)throw Object.assign(new Error('Demande déjà traitée'),{status:409});
    await tx.supplierSaasSubscription.updateMany({
      where:{companyId:current.companyId,status:{in:[SubscriptionStatus.ACTIVE,SubscriptionStatus.TRIAL]}},
      data:{status:SubscriptionStatus.CANCELLED}
    });
    const sub=await tx.supplierSaasSubscription.create({data:{
      companyId:current.companyId,planId:plan.id,status:SubscriptionStatus.ACTIVE,
      agreedPrice,startsAt:now,endsAt,
      note:['Paiement vérifié dans Fixi Control',transferReference?'Réf. externe : '+transferReference:'',
        note||''].filter(Boolean).join(' · ')
    }});
    const reference='FX-SUP-'+crypto.randomUUID();
    const payment=await tx.supplierSaasPayment.create({data:{
      companyId:current.companyId,subscriptionId:sub.id,amount:paid,
      method:current.paymentMethod==='CONTACT'?'MANUEL':current.paymentMethod,
      reference,paidAt:now,note:[
        'Règlement contrôlé manuellement',transferReference?'Réf. transaction : '+transferReference:'',
        note||''
      ].filter(Boolean).join(' · ')
    }});
    await tx.supplierSubscriptionRequest.update({
      where:{id},data:{status:'APPROVED',subscriptionId:sub.id,reviewedAt:now,
        reviewedById:admin.id,adminNote:note,
        transferReference:transferReference||current.transferReference}
    });
    return {subscriptionId:sub.id,paymentId:payment.id};
  });
  return ok(plain({status:'APPROVED',...result}));
 }catch(e:any){return bad(e.message,e.status||500)}
}
