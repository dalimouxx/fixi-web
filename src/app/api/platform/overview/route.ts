import { prisma } from '@/lib/prisma';
import { requirePlatformSession } from '@/lib/platform-auth';
import { bad,ok } from '@/lib/http';
import { PaymentKind,SubscriptionStatus,SupportTicketStatus } from '@prisma/client';
import { plain } from '@/lib/serializers';

export async function GET(req:Request){
  try{
    await requirePlatformSession();
    const u=new URL(req.url);
    const days=Math.max(1,Math.min(365,Number(u.searchParams.get('days')||30)));
    const since=new Date(Date.now()-days*86400000);
    const onlineCut=new Date(Date.now()-90_000);
    const inactiveCut=new Date(Date.now()-10*60_000);
    const [tenants,shops,users,repairs,activeSubs,online,idle,expiring,openSupport,payments,shopRows,campaigns]=await Promise.all([
      prisma.tenant.count(),
      prisma.shop.count({where:{isActive:true}}),
      prisma.user.count({where:{isActive:true}}),
      prisma.repair.count({where:{createdAt:{gte:since}}}),
      prisma.subscription.count({where:{status:{in:[SubscriptionStatus.TRIAL,SubscriptionStatus.ACTIVE]}}}),
      prisma.shop.count({where:{isActive:true,lastSeenAt:{gte:onlineCut}}}),
      prisma.shop.count({where:{isActive:true,lastSeenAt:{gte:inactiveCut,lt:onlineCut}}}),
      prisma.subscription.count({where:{status:{in:[SubscriptionStatus.TRIAL,SubscriptionStatus.ACTIVE]},endsAt:{gte:new Date(),lte:new Date(Date.now()+7*86400000)}}}),
      prisma.supportTicket.count({where:{status:{in:[SupportTicketStatus.OPEN,SupportTicketStatus.IN_PROGRESS,SupportTicketStatus.WAITING_SHOP]}}}),
      prisma.payment.findMany({where:{createdAt:{gte:since}},select:{shopId:true,amount:true,kind:true}}),
      prisma.shop.findMany({
        where:{isActive:true},
        select:{
          id:true,name:true,slug:true,region:true,lastSeenAt:true,lastLoginAt:true,
          _count:{select:{users:true,repairs:true}},
          tenant:{select:{name:true,subscriptions:{include:{plan:true},orderBy:{createdAt:'desc'},take:1}}}
        }
      }),
      prisma.adCampaign.count({where:{status:'ACTIVE',startsAt:{lte:new Date()},endsAt:{gte:new Date()}}})
    ]);
    const rev=new Map<string,number>();
    for(const p of payments){rev.set(p.shopId,(rev.get(p.shopId)||0)+(p.kind===PaymentKind.PAYMENT?Number(p.amount):-Number(p.amount)))}
    const top=shopRows.map(s=>({...s,revenue:rev.get(s.id)||0,presence:!s.lastSeenAt?'OFFLINE':s.lastSeenAt>=onlineCut?'ONLINE':s.lastSeenAt>=inactiveCut?'IDLE':'OFFLINE'})).sort((a,b)=>b.revenue-a.revenue);
    const regionCounts=top.reduce((a:Record<string,number>,s)=>{a[s.region]=(a[s.region]||0)+1;return a},{});
    return ok(plain({
      periodDays:days,tenants,shops,users,repairs,activeSubs,online,idle,
      offline:Math.max(0,shops-online-idle),expiring,openSupport,activeCampaigns:campaigns,
      totalRevenue:[...rev.values()].reduce((a,b)=>a+b,0),top:top.slice(0,20),
      regions:Object.entries(regionCounts).map(([region,count])=>({region,count}))
    }));
  }catch(e:any){return bad(e.message,e.status||500)}
}
