import {prisma} from '@/lib/prisma';
import {requirePlatformSession} from '@/lib/platform-auth';
import {bad,ok} from '@/lib/http';
import {DurationUnit,SubscriptionRequestStatus,SubscriptionStatus} from '@prisma/client';
import {addDuration} from '@/lib/subscription-duration';
import {plain} from '@/lib/serializers';

export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  await requirePlatformSession();
  const {id}=await params,b=await req.json();
  const x=await prisma.subscriptionRequest.findUnique({where:{id},include:{plan:true}});
  if(!x)return bad('Demande introuvable',404);
  if(x.status!==SubscriptionRequestStatus.PENDING)return bad('Demande déjà traitée',409);
  const adminNote=String(b.adminNote||'').trim().slice(0,1200)||null;
  if(b.action==='REJECT'){
    if(!adminNote)return bad('Motif du refus obligatoire',400);
    const u=await prisma.subscriptionRequest.updateMany({
      where:{id,status:SubscriptionRequestStatus.PENDING},
      data:{status:SubscriptionRequestStatus.REJECTED,adminNote,reviewedAt:new Date()}
    });
    return u.count?ok({status:'REJECTED'}):bad('Demande déjà traitée',409);
  }
  if(b.action!=='APPROVE')return bad('Action invalide',400);
  const planId=String(b.planId||x.planId||'');
  if(!planId)return bad('Formule requise',400);
  const plan=await prisma.plan.findUnique({where:{id:planId}});
  if(!plan||!plan.active)return bad('Offre indisponible',404);
  const unit=(b.durationUnit&&Object.values(DurationUnit).includes(b.durationUnit))?
    b.durationUnit:x.durationUnit||plan.durationUnit;
  const value=Number(b.durationValue??x.durationValue??plan.durationValue??1);
  if(!Number.isSafeInteger(value)||value<1||value>120)return bad('Durée invalide',400);
  const startsAt=b.startsAt?new Date(b.startsAt):new Date();
  const endsAt=b.endsAt?new Date(b.endsAt):addDuration(startsAt,value,unit);
  if(!Number.isFinite(startsAt.getTime())||!Number.isFinite(endsAt.getTime())||endsAt<=startsAt)
    return bad('Dates de période invalides',400);
  const agreedPrice=b.price===undefined?Number(x.requestedPrice??plan.price):Number(b.price);
  if(!Number.isFinite(agreedPrice)||agreedPrice<0||agreedPrice>10000000)
    return bad('Prix convenu invalide',400);
  const verifiedAmount=Number(b.verifiedAmount);
  if(agreedPrice>0){
    if(b.verified!==true)return bad('Confirmez la vérification du crédit D17 ou bancaire',400);
    if(!Number.isFinite(verifiedAmount)||verifiedAmount<agreedPrice-0.001||verifiedAmount>10000000)
      return bad('Montant confirmé inférieur au prix convenu',400);
    if(!String(b.reference||x.transferReference||adminNote||'').trim())
      return bad('Référence de rapprochement ou note obligatoire',400);
  }
  const result=await prisma.$transaction(async tx=>{
    const u=await tx.subscriptionRequest.updateMany({
      where:{id,status:SubscriptionRequestStatus.PENDING},
      data:{status:SubscriptionRequestStatus.APPROVED}
    });
    if(!u.count)throw Object.assign(new Error('Demande déjà traitée'),{status:409});
    await tx.subscription.updateMany({where:{tenantId:x.tenantId,
      status:{in:[SubscriptionStatus.ACTIVE,SubscriptionStatus.TRIAL]}},
      data:{status:SubscriptionStatus.CANCELLED}
    });
    const sub=await tx.subscription.create({
      data:{tenantId:x.tenantId,planId,status:SubscriptionStatus.ACTIVE,
        startsAt,endsAt,agreedPrice,notes:adminNote||x.note||null}
    });
    await tx.subscriptionRequest.update({where:{id},data:{
      status:SubscriptionRequestStatus.APPROVED,adminNote,
      reviewedAt:new Date(),durationValue:value,durationUnit:unit,
      requestedPrice:agreedPrice,
      transferReference:String(b.reference||x.transferReference||'').slice(0,100)||null
    }});
    if(agreedPrice>0)await tx.saasPayment.create({
      data:{tenantId:x.tenantId,amount:verifiedAmount,
        method:String(b.paymentMethod||x.paymentMethod||'MANUAL').slice(0,40),
        reference:String(b.reference||x.transferReference||'').slice(0,100)||null,
        note:'Abonnement validé après contrôle manuel',status:'CONFIRMED'}
    });
    return sub;
  });
  return ok(plain(result));
 }catch(e:any){return bad(e.message,e.status||500)}
}
