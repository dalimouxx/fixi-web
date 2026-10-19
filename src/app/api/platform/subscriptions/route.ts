import { prisma } from '@/lib/prisma';
import { requirePlatformSession } from '@/lib/platform-auth';
import { bad, ok } from '@/lib/http';
import { plain } from '@/lib/serializers';
import { SubscriptionStatus } from '@prisma/client';
import { addDuration } from '@/lib/subscription-duration';

export const dynamic='force-dynamic';

/** Only platform administrators can assign workshop subscriptions. */
export async function POST(req: Request) {
  try {
    await requirePlatformSession();
    const b=await req.json();
    const tenantId=String(b.tenantId||''),planId=String(b.planId||'');
    const [tenant,plan]=await Promise.all([
      prisma.tenant.findUnique({where:{id:tenantId},select:{id:true,name:true}}),
      prisma.plan.findFirst({where:{id:planId,active:true}}),
    ]);
    if(!tenant||!plan)return bad('Client ou offre introuvable',404);
    const free=plan.code==='CONNECT';
    const status=free?'ACTIVE':String(b.status||'TRIAL');
    if(!Object.values(SubscriptionStatus).includes(status as SubscriptionStatus))return bad('Statut invalide',400);
    const startsAt=b.startsAt?new Date(b.startsAt):new Date();
    if(!Number.isFinite(startsAt.getTime()))return bad('Date de début invalide',400);
    const endsAt=free?null:b.endsAt===null?null:b.endsAt?new Date(b.endsAt):
      status==='TRIAL'?new Date(startsAt.getTime()+plan.trialDays*86400000):
      addDuration(startsAt,plan.durationValue,plan.durationUnit);
    if(endsAt&&(!Number.isFinite(endsAt.getTime())||endsAt<=startsAt))
      return bad('Date de fin invalide',400);
    const sub=await prisma.subscription.create({
      data:{tenantId,planId,status:status as SubscriptionStatus,startsAt,endsAt,
        notes:String(b.notes||'').slice(0,1500)||null},
      include:{plan:true},
    });
    return ok(plain(sub),{status:201});
  }catch(e:any){return bad(e.message,e.status||500)}
}
