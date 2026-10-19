import { prisma } from '@/lib/prisma';
import { requirePlatformSession } from '@/lib/platform-auth';
import { bad,ok } from '@/lib/http';
import { plain } from '@/lib/serializers';
import { ensureSupplierSaasPlans } from '@/lib/supplier-saas';
import { addDuration } from '@/lib/subscription-duration';
import { DurationUnit, SubscriptionStatus } from '@prisma/client';
import crypto from 'node:crypto';

export const dynamic='force-dynamic';
const activeStatuses=new Set<string>(Object.values(SubscriptionStatus));
const validMoney=(x:unknown)=>typeof x==='number'||typeof x==='string'
  ?Number.isFinite(Number(x))&&Number(x)>=0&&Number(x)<=10000000 : false;
const positiveInt=(x:unknown,maximum:number)=>Number.isSafeInteger(Number(x))&&Number(x)>0&&Number(x)<=maximum;

export async function GET() {
  try {
    await requirePlatformSession();
    await ensureSupplierSaasPlans();
    const [plans,companies]=await Promise.all([
      prisma.supplierSaasPlan.findMany({orderBy:{price:'asc'}}),
      prisma.supplierCompany.findMany({
        select:{
          id:true,name:true,slug:true,active:true,region:true,
          saasSubscriptions:{include:{plan:true,payments:{orderBy:{paidAt:'desc'}}},orderBy:{createdAt:'desc'},take:12},
          _count:{select:{products:true,orders:true,accounts:true}},
        },orderBy:{name:'asc'},
      }),
    ]);
    return ok(plain({plans,companies}));
  } catch(e:any){return bad(e.message,e.status||500);}
}

export async function POST(req:Request) {
  try {
    await requirePlatformSession();
    const b=await req.json(),action=String(b.action||'');
    if(action==='ASSIGN'){
      const companyId=String(b.companyId||''),planId=String(b.planId||'');
      const [company,plan]=await Promise.all([
        prisma.supplierCompany.findUnique({where:{id:companyId},select:{id:true}}),
        prisma.supplierSaasPlan.findFirst({where:{id:planId,active:true}}),
      ]);
      if(!company||!plan)return bad('Fournisseur ou offre introuvable',404);
      const status=String(b.status||'TRIAL');
      if(!activeStatuses.has(String(status)))return bad('Statut invalide');
      const startsAt=b.startsAt?new Date(b.startsAt):new Date();
      if(Number.isNaN(startsAt.getTime()))return bad('Date de début invalide');
      const endsAt=b.endsAt?new Date(b.endsAt):
        status==='TRIAL'?new Date(startsAt.getTime()+plan.trialDays*86400000):
        addDuration(startsAt,plan.durationValue,plan.durationUnit);
      if(Number.isNaN(endsAt.getTime())||endsAt<=startsAt)return bad('Date de fin invalide');
      const price=b.agreedPrice===undefined?Number(plan.price):b.agreedPrice;
      if(!validMoney(price))return bad('Prix invalide');
      const sub=await prisma.supplierSaasSubscription.create({
        data:{companyId,planId,status:status as SubscriptionStatus,agreedPrice:Number(price),
          startsAt,endsAt,note:String(b.note||'').slice(0,1500)||null},
        include:{plan:true},
      });
      return ok(plain(sub),{status:201});
    }
    if(action==='PAYMENT'){
      const sub=await prisma.supplierSaasSubscription.findUnique({where:{id:String(b.subscriptionId||'')}});
      if(!sub)return bad('Abonnement fournisseur introuvable',404);
      if(!validMoney(b.amount)||Number(b.amount)<=0)return bad('Montant de paiement invalide');
      const method=String(b.method||'').trim().slice(0,40);
      if(!method)return bad('Moyen de paiement obligatoire');
      const paidAt=b.paidAt?new Date(b.paidAt):new Date();
      if(Number.isNaN(paidAt.getTime()))return bad('Date de paiement invalide');
      const payment=await prisma.supplierSaasPayment.create({
        data:{subscriptionId:sub.id,companyId:sub.companyId,amount:Number(b.amount),method,
          paidAt,reference:String(b.reference||'SAB-'+crypto.randomUUID()).slice(0,100),
          note:String(b.note||'').slice(0,1500)||null},
      });
      return ok(plain(payment),{status:201});
    }
    if(action==='PLAN'){
      const code=String(b.code||'').trim().toUpperCase().replace(/[^A-Z0-9_-]/g,'');
      const name=String(b.name||'').trim();
      if(code.length<3||name.length<3||!validMoney(b.price))return bad('Code, nom et prix valides requis');
      const durationUnit=Object.values(DurationUnit).includes(b.durationUnit)?b.durationUnit:DurationUnit.MONTH;
      if(!positiveInt(b.durationValue||1,120))return bad('Durée invalide');
      const limits=['maxProducts','maxDrivers','maxStaff','maxOrdersPerMonth'];
      for(const k of limits)if(!positiveInt(b[k],1000000))return bad('Limite invalide : '+k);
      const plan=await prisma.supplierSaasPlan.create({data:{
        code,name,description:String(b.description||'').slice(0,500)||null,
        price:Number(b.price),durationValue:Number(b.durationValue||1),durationUnit,
        trialDays:Math.max(0,Math.min(90,Math.trunc(Number(b.trialDays||0)))),
        maxProducts:Number(b.maxProducts),maxDrivers:Number(b.maxDrivers),
        maxStaff:Number(b.maxStaff),maxOrdersPerMonth:Number(b.maxOrdersPerMonth),
        features:{catalogue:true,orders:true,delivery:true,finance:true},
        active:true,publicVisible:b.publicVisible!==false,
      }});
      return ok(plain(plan),{status:201});
    }
    return bad('Action inconnue',400);
  }catch(e:any){if(e.code==='P2002')return bad('Référence ou code déjà utilisé',409);return bad(e.message,e.status||500);}
}

export async function PATCH(req:Request) {
  try {
    await requirePlatformSession();
    const b=await req.json();
    if(b.action==='SUBSCRIPTION'){
      const id=String(b.id||'');
      const current=await prisma.supplierSaasSubscription.findUnique({where:{id}});
      if(!current)return bad('Abonnement introuvable',404);
      const status=b.status?String(b.status):current.status;
      if(!activeStatuses.has(status))return bad('Statut invalide');
      const selected=b.planId?await prisma.supplierSaasPlan.findUnique({where:{id:String(b.planId)}}):null;
      if(b.planId&&!selected)return bad('Offre introuvable',404);
      const startsAt=b.startsAt===undefined?current.startsAt:new Date(b.startsAt);
      const endsAt=b.endsAt===undefined?current.endsAt:
        b.endsAt===null||b.endsAt===''?null:new Date(b.endsAt);
      if(!Number.isFinite(startsAt.getTime())||(endsAt&&!Number.isFinite(endsAt.getTime())))
        return bad('Date invalide',400);
      if(endsAt&&endsAt<=startsAt)return bad('La fin doit être après le début',400);
      if(b.agreedPrice!==undefined&&!validMoney(b.agreedPrice))return bad('Prix convenu invalide',400);
      const row=await prisma.supplierSaasSubscription.update({where:{id},data:{
        planId:selected?.id,
        status:status as SubscriptionStatus,
        startsAt:b.startsAt===undefined?undefined:startsAt,
        endsAt,
        agreedPrice:b.agreedPrice===undefined?undefined:Number(b.agreedPrice),
        note:b.note===undefined?undefined:String(b.note).slice(0,1500),
      }});
      return ok(plain(row));
    }
    if(b.action==='PLAN'){
      const id=String(b.id||'');
      const found=await prisma.supplierSaasPlan.findUnique({where:{id}});
      if(!found)return bad('Offre introuvable',404);
      const changes:any={};
      for(const key of ['name','description'])if(b[key]!==undefined)changes[key]=String(b[key]).slice(0,500);
      if(b.durationUnit!==undefined){
        if(!Object.values(DurationUnit).includes(b.durationUnit))return bad('Unité de durée invalide',400);
        changes.durationUnit=b.durationUnit;
      }
      for(const key of ['active','publicVisible'])if(typeof b[key]==='boolean')changes[key]=b[key];
      if(b.price!==undefined){if(!validMoney(b.price))return bad('Prix invalide');changes.price=Number(b.price);}
      for(const key of ['maxProducts','maxDrivers','maxStaff','maxOrdersPerMonth','durationValue']){
        if(b[key]!==undefined){if(!positiveInt(b[key],1000000))return bad('Limite invalide : '+key);changes[key]=Number(b[key]);}
      }
      if(b.trialDays!==undefined){
        if(!Number.isSafeInteger(Number(b.trialDays))||Number(b.trialDays)<0||Number(b.trialDays)>365)
          return bad('Durée d’essai invalide',400);
        changes.trialDays=Number(b.trialDays);
      }
      const row=await prisma.supplierSaasPlan.update({where:{id},data:changes});
      return ok(plain(row));
    }
    return bad('Action inconnue');
  }catch(e:any){return bad(e.message,e.status||500);}
}

/** Delete unused custom plans. Referenced plans and financial records are archived, not erased. */
export async function DELETE(req:Request){
 try{
  await requirePlatformSession();
  const b=await req.json(),action=String(b.action||'');
  if(action==='PLAN'){
    const id=String(b.id||'');
    const plan=await prisma.supplierSaasPlan.findUnique({where:{id}});
    if(!plan)return bad('Formule introuvable',404);
    const count=await prisma.supplierSaasSubscription.count({where:{planId:id}});
    if(count||['ESSENTIAL','PRO','BUSINESS'].includes(plan.code)){
      await prisma.supplierSaasPlan.update({where:{id},data:{active:false,publicVisible:false}});
      return ok({deleted:false,archived:true,message:'Formule masquée afin de préserver les abonnements et les tarifs historiques.'});
    }
    await prisma.supplierSaasPlan.delete({where:{id}});
    return ok({deleted:true,archived:false});
  }
  if(action==='SUBSCRIPTION'){
    const id=String(b.id||'');
    const sub=await prisma.supplierSaasSubscription.findUnique({where:{id}});
    if(!sub)return bad('Abonnement introuvable',404);
    const [payments,count]=await Promise.all([
      prisma.supplierSaasPayment.count({where:{subscriptionId:id}}),
      prisma.supplierSaasSubscription.count({where:{companyId:sub.companyId}}),
    ]);
    // Never turn a paying supplier into an unmetered grandfathered supplier by deleting their only record.
    if(count>1&&sub.status==='TRIAL'&&payments===0){
      await prisma.supplierSaasSubscription.delete({where:{id}});
      return ok({deleted:true,archived:false});
    }
    await prisma.supplierSaasSubscription.update({where:{id},data:{
      status:'CANCELLED',note:((sub.note||'')+'\nArchivé par Fixi Admin').slice(0,1500),
    }});
    return ok({deleted:false,archived:true,message:'Abonnement archivé : les reçus et les accès restent traçables.'});
  }
  return bad('Action inconnue',400);
 }catch(e:any){return bad(e.message,e.status||500);}
}
