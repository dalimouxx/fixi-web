import { prisma } from '@/lib/prisma';
import { requirePlatformSession } from '@/lib/platform-auth';
import { bad,ok } from '@/lib/http';
import { PaymentKind,UserRole,AutomationTrigger,AutomationAction } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { plain } from '@/lib/serializers';

export async function GET(){
  try{
    await requirePlatformSession();
    const since=new Date(Date.now()-30*86400000);
    const [rows,payments]=await Promise.all([
      prisma.shop.findMany({include:{tenant:{include:{subscriptions:{include:{plan:true},orderBy:{createdAt:'desc'},take:1}}},_count:{select:{users:true,repairs:true,clients:true}}},orderBy:[{region:'asc'},{name:'asc'}]}),
      prisma.payment.findMany({where:{createdAt:{gte:since}},select:{shopId:true,amount:true,kind:true}})
    ]);
    const revenue=new Map<string,number>();
    for(const p of payments)revenue.set(p.shopId,(revenue.get(p.shopId)||0)+(p.kind===PaymentKind.PAYMENT?Number(p.amount):-Number(p.amount)));
    return ok(plain(rows.map(x=>({...x,revenue30:revenue.get(x.id)||0}))));
  }catch(e:any){return bad(e.message,e.status||500)}
}

export async function POST(req:Request){
  try{
    await requirePlatformSession();const b=await req.json();
    for(const k of ['tenantId','shopName','slug','region','adminName','loginCode','pin'])if(!String(b[k]||'').trim())return bad(`${k} requis`);
    if(!/^\d{6}$/.test(String(b.pin)))return bad('Le PIN initial doit contenir exactement 6 chiffres');
    const tenant=await prisma.tenant.findUnique({where:{id:b.tenantId},include:{shops:true,subscriptions:{include:{plan:true},orderBy:{createdAt:'desc'},take:1}}});
    if(!tenant)return bad('Client introuvable',404);
    const sub=tenant.subscriptions[0];if(sub&&tenant.shops.length>=sub.plan.maxShops)return bad(`Limite du plan atteinte (${sub.plan.maxShops} boutique(s))`,409);
    const pinHash=await bcrypt.hash(String(b.pin),12);
    const shop=await prisma.shop.create({data:{tenantId:tenant.id,name:b.shopName,slug:String(b.slug).toLowerCase().replace(/[^a-z0-9-]/g,'-'),region:String(b.region),city:b.city||null,phone:b.phone||null,whatsappPhone:b.whatsappPhone||null,address:b.address||null,publicVisible:!!b.publicVisible,users:{create:{fullName:b.adminName,loginCode:String(b.loginCode).toLowerCase(),role:UserRole.ADMIN,pinHash,mustChangePin:true}}},include:{users:{select:{id:true,fullName:true,loginCode:true}}}});
    await prisma.automationRule.createMany({data:[
      {shopId:shop.id,name:'Smart Assign',trigger:AutomationTrigger.REPAIR_CREATED,action:AutomationAction.ASSIGN_TECHNICIAN,delayMinutes:5},
      {shopId:shop.id,name:'Relance appareil prêt 72h',trigger:AutomationTrigger.READY_OVERDUE,action:AutomationAction.WHATSAPP_SUGGESTION,delayMinutes:4320},
      {shopId:shop.id,name:'Alerte stock faible',trigger:AutomationTrigger.LOW_STOCK,action:AutomationAction.NOTIFICATION,delayMinutes:0},
      {shopId:shop.id,name:'Écart de caisse',trigger:AutomationTrigger.CASH_DIFFERENCE,action:AutomationAction.NOTIFICATION,delayMinutes:0}
    ]});
    return ok(plain(shop),{status:201});
  }catch(e:any){if(e.code==='P2002')return bad('Slug ou identifiant déjà utilisé',409);return bad(e.message,e.status||500)}
}
