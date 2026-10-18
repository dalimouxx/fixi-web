import { prisma } from '@/lib/prisma';import { requirePlatformSession } from '@/lib/platform-auth';import { bad,ok } from '@/lib/http';import { SubscriptionStatus } from '@prisma/client';import { plain } from '@/lib/serializers';
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){try{await requirePlatformSession();const {id}=await params;const b=await req.json();if(b.status&&!Object.values(SubscriptionStatus).includes(b.status))return bad('Statut invalide');const selected=b.planId?await prisma.plan.findUnique({where:{id:String(b.planId)}}):null;
if(b.planId&&!selected)return bad('Plan introuvable',404);
const current=await prisma.subscription.findUnique({where:{id},include:{plan:true}});
if(!current)return bad('Abonnement introuvable',404);
const free=(selected||current.plan).code==='CONNECT';
const x=await prisma.subscription.update({where:{id},data:{
  status:free?SubscriptionStatus.ACTIVE:b.status,
  planId:b.planId||undefined,
  endsAt:free?null:b.endsAt?new Date(b.endsAt):b.endsAt===null?null:undefined,
  notes:b.notes,
}});return ok(plain(x))}catch(e:any){return bad(e.message,e.status||500)}}
