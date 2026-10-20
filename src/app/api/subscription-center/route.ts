import { prisma } from '@/lib/prisma';import { requireSession } from '@/lib/auth';import { bad,ok } from '@/lib/http';import { DurationUnit,SubscriptionRequestStatus,UserRole } from '@prisma/client';import { plain } from '@/lib/serializers';import { ensureConnectPlan } from '@/lib/freemium';import {validateSubscriptionProof,normalizedTransferRef} from '@/lib/subscription-proof';
export async function GET(){try{const s=await requireSession([UserRole.ADMIN],'CONNECT');await ensureConnectPlan();const shop=await prisma.shop.findUniqueOrThrow({where:{id:s.shopId},include:{tenant:{include:{subscriptions:{include:{plan:true},orderBy:{createdAt:'desc'},take:1}}}}});const [plans,requests,settings]=await Promise.all([prisma.plan.findMany({where:{active:true,publicVisible:true},orderBy:{price:'asc'}}),prisma.subscriptionRequest.findMany({where:{shopId:s.shopId},include:{plan:true},orderBy:{createdAt:'desc'},take:30}),prisma.platformSettings.findUnique({where:{id:'platform'}})]);return ok(plain({accessTier:s.accessTier,current:shop.tenant.subscriptions[0]||null,plans,requests,contact:{phone:settings?.supportPhone,email:settings?.supportEmail},
    payee:{d17Phone:settings?.paymentD17Phone||null,bankName:settings?.paymentBankName||null,
      bankRib:settings?.paymentBankRib||null,instructions:settings?.paymentInstructions||null}}))}catch(e:any){return bad(e.message,e.status||500)}}
export async function POST(req:Request){
 try{
  const s=await requireSession([UserRole.ADMIN],'CONNECT'),b=await req.json();
  const shop=await prisma.shop.findUniqueOrThrow({where:{id:s.shopId}});
  const method=String(b.paymentMethod||'CONTACT').toUpperCase();
  if(!['D17','VIREMENT','CONTACT'].includes(method))return bad('Choisissez D17, virement ou demande de contact',400);
  const proof=validateSubscriptionProof(b.proofDataUrl);
  if(!proof.valid)return bad(proof.error||'Preuve invalide',400);
  if(method==='CONTACT'&&b.proofDataUrl)return bad('Choisissez D17 ou virement pour envoyer un justificatif',400);
  const settings=await prisma.platformSettings.findUnique({where:{id:'platform'}});
  if(method==='D17'&&!settings?.paymentD17Phone)return bad('Numéro D17 Fixi non configuré : contactez Fixi',409);
  if(method==='VIREMENT'&&!settings?.paymentBankRib)return bad('RIB Fixi non configuré : contactez Fixi',409);
  const pending=await prisma.subscriptionRequest.count({
    where:{shopId:shop.id,status:SubscriptionRequestStatus.PENDING}
  });
  if(pending>=3)return bad('Vous avez déjà trois demandes en attente de vérification',409);
  let plan=null;
  if(b.planId){
    plan=await prisma.plan.findFirst({where:{id:String(b.planId),active:true}});
    if(!plan)return bad('Offre introuvable',404);
    if(plan.code==='CONNECT')return bad('Connect est déjà gratuit, aucun paiement requis',409);
  }
  const durationValue=b.durationValue===undefined?plan?.durationValue||null:Number(b.durationValue);
  if(durationValue!==null&&(!Number.isSafeInteger(durationValue)||durationValue<1||durationValue>120))
    return bad('Durée invalide',400);
  const durationUnit=(b.durationUnit&&Object.values(DurationUnit).includes(b.durationUnit))?
    b.durationUnit:plan?.durationUnit||null;
  const x=await prisma.subscriptionRequest.create({data:{
    tenantId:shop.tenantId,shopId:shop.id,planId:plan?.id||null,
    requestedPrice:plan?.price||null,durationValue,durationUnit,
    status:SubscriptionRequestStatus.PENDING,paymentMethod:method,
    transferReference:normalizedTransferRef(b.transferReference),
    proofDataUrl:b.proofDataUrl||null,note:String(b.note||'').slice(0,1200)||null
  }});
  return ok(plain({id:x.id,status:x.status}),{status:201});
 }catch(e:any){return bad(e.message,e.status||500)}
}