import {prisma} from '@/lib/prisma';
import {requireSupplierSession} from '@/lib/supplier-auth';
import {bad,ok} from '@/lib/http';
import {plain} from '@/lib/serializers';
import {validateSubscriptionProof,normalizedTransferRef} from '@/lib/subscription-proof';

export const dynamic='force-dynamic';
const methods=new Set(['D17','VIREMENT','CONTACT']);

export async function GET(){
 try{
  const s=await requireSupplierSession();
  const [requests,settings]=await Promise.all([
    prisma.supplierSubscriptionRequest.findMany({
      where:{companyId:s.companyId},orderBy:{createdAt:'desc'},take:30
    }),
    prisma.platformSettings.findUnique({where:{id:'platform'},select:{
      supportEmail:true,supportPhone:true,paymentD17Phone:true,paymentBankName:true,
      paymentBankRib:true,paymentInstructions:true
    }})
  ]);
  return ok(plain({
    requests:requests.map(({proofDataUrl,...x})=>({...x,hasProof:!!proofDataUrl})),
    payee:settings?{
      d17Phone:settings.paymentD17Phone,bankName:settings.paymentBankName,
      bankRib:settings.paymentBankRib,instructions:settings.paymentInstructions,
      supportPhone:settings.supportPhone,supportEmail:settings.supportEmail
    }:null
  }));
 }catch(e:any){return bad(e.message,e.status||500)}
}
export async function POST(req:Request){
 try{
  const s=await requireSupplierSession();
  if(!['OWNER','ADMIN'].includes(s.role))return bad('Seul un responsable fournisseur peut demander un abonnement',403);
  const b=await req.json();
  const planId=String(b.planId||''),method=String(b.paymentMethod||'CONTACT').toUpperCase();
  if(!methods.has(method))return bad('Moyen de paiement invalide',400);
  const plan=await prisma.supplierSaasPlan.findFirst({
    where:{id:planId,active:true,publicVisible:true}
  });
  if(!plan)return bad('Formule fournisseur introuvable',404);
  const count=await prisma.supplierSubscriptionRequest.count({
    where:{companyId:s.companyId,status:'PENDING'}
  });
  if(count>=3)return bad('Vous avez déjà trois demandes ouvertes. Vérifiez leur historique ou contactez Fixi.',409);
  const proof=validateSubscriptionProof(b.proofDataUrl);
  if(!proof.valid)return bad(proof.error||'Preuve invalide',400);
  const settings=await prisma.platformSettings.findUnique({where:{id:'platform'}});
  if(method==='D17'&&!settings?.paymentD17Phone)
    return bad('Le bénéficiaire D17 Fixi n’est pas encore configuré. Choisissez « Contacter Fixi ».',409);
  if(method==='VIREMENT'&&!settings?.paymentBankRib)
    return bad('Le RIB Fixi n’est pas encore configuré. Choisissez « Contacter Fixi ».',409);
  if(method==='CONTACT'&&b.proofDataUrl)return bad('Sélectionnez D17 ou virement pour joindre une preuve.',400);
  const x=await prisma.supplierSubscriptionRequest.create({data:{
    companyId:s.companyId,planId:plan.id,requestedPrice:plan.price,
    durationValue:plan.durationValue,durationUnit:plan.durationUnit,
    paymentMethod:method,transferReference:normalizedTransferRef(b.transferReference),
    proofDataUrl:b.proofDataUrl||null,note:String(b.note||'').trim().slice(0,1200)||null
  }});
  return ok(plain({id:x.id,status:x.status,hasProof:!!x.proofDataUrl}),{status:201});
 }catch(e:any){return bad(e.message,e.status||500)}
}

export async function PATCH(req:Request){
 try{
  const s=await requireSupplierSession();
  if(!['OWNER','ADMIN'].includes(s.role))return bad('Seul un responsable fournisseur peut envoyer un justificatif',403);
  const b=await req.json(),id=String(b.id||'');
  const proof=validateSubscriptionProof(b.proofDataUrl);
  if(!b.proofDataUrl||!proof.valid)return bad(proof.error||'Ajoutez un justificatif valide',400);
  const previous=await prisma.supplierSubscriptionRequest.findFirst({
    where:{id,companyId:s.companyId,status:'PENDING'}
  });
  if(!previous)return bad('Cette demande ne peut plus être modifiée',404);
  if(previous.paymentMethod==='CONTACT')return bad('Choisissez D17 ou virement dans une nouvelle demande de règlement',409);
  const updated=await prisma.supplierSubscriptionRequest.updateMany({
    where:{id,companyId:s.companyId,status:'PENDING'},data:{
      proofDataUrl:b.proofDataUrl,transferReference:normalizedTransferRef(b.transferReference)||previous.transferReference
    }
  });
  if(!updated.count)return bad('Demande déjà traitée',409);
  return ok({id,status:'PENDING',hasProof:true});
 }catch(e:any){return bad(e.message,e.status||500)}
}
