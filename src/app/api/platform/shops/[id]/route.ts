import { prisma } from '@/lib/prisma';
import { requirePlatformSession } from '@/lib/platform-auth';
import { bad,ok } from '@/lib/http';
import { plain } from '@/lib/serializers';
import { PaymentKind } from '@prisma/client';

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
  try{
    await requirePlatformSession();
    const {id}=await params;
    const shop=await prisma.shop.findUnique({where:{id},include:{tenant:{include:{subscriptions:{include:{plan:true},orderBy:{createdAt:'desc'}}}},users:{select:{id:true,fullName:true,role:true,isActive:true,lastSeenAt:true}},rewards:{orderBy:{createdAt:'desc'},take:20},_count:{select:{repairs:true,clients:true,users:true}}}});
    if(!shop)return bad('Boutique introuvable',404);
    const payments=await prisma.payment.findMany({where:{shopId:id},select:{amount:true,kind:true,createdAt:true},orderBy:{createdAt:'desc'},take:500});
    const revenue=payments.reduce((a,p)=>a+(p.kind===PaymentKind.PAYMENT?Number(p.amount):-Number(p.amount)),0);
    return ok(plain({...shop,revenue}));
  }catch(e:any){return bad(e.message,e.status||500)}
}

export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
  try{
    await requirePlatformSession();
    const {id}=await params;
    const b=await req.json();
    const data:any={};
    for(const k of ['name','region','city','address','phone','whatsappPhone','email','website','isActive','queueShowClient','platformNotes','publicVisible','publicFeatured','publicDescription','coverDataUrl','logoDataUrl'])if(b[k]!==undefined)data[k]=b[k];
    if(b.publicServices!==undefined){if(!Array.isArray(b.publicServices))return bad('Services publics invalides');data.publicServices=b.publicServices.map((x:any)=>String(x).trim()).filter(Boolean).slice(0,30)}
    if(b.openingHours!==undefined)data.openingHours=b.openingHours&&typeof b.openingHours==='object'?b.openingHours:null;
    if(b.latitude!==undefined){if(b.latitude===null||b.latitude==='')data.latitude=null;else{const v=Number(b.latitude);if(!Number.isFinite(v)||v<-90||v>90)return bad('Latitude invalide');data.latitude=v}}
    if(b.longitude!==undefined){if(b.longitude===null||b.longitude==='')data.longitude=null;else{const v=Number(b.longitude);if(!Number.isFinite(v)||v<-180||v>180)return bad('Longitude invalide');data.longitude=v}}
    if(data.publicDescription&&String(data.publicDescription).length>1000)return bad('Description publique trop longue');
    if(data.coverDataUrl&&String(data.coverDataUrl).length>5_500_000)return bad('Image de couverture trop volumineuse');
    if(data.logoDataUrl&&String(data.logoDataUrl).length>2_500_000)return bad('Logo trop volumineux');
    if(b.slug!==undefined)data.slug=String(b.slug).toLowerCase().replace(/[^a-z0-9-]/g,'-');
    const x=await prisma.shop.update({where:{id},data});
    return ok(plain(x));
  }catch(e:any){if(e.code==='P2002')return bad('Code boutique déjà utilisé',409);return bad(e.message,e.status||500)}
}

export async function DELETE(req:Request,{params}:{params:Promise<{id:string}>}){
  try{
    await requirePlatformSession();
    const {id}=await params;
    const b=await req.json().catch(()=>({}));
    const shop=await prisma.shop.findUnique({where:{id}});
    if(!shop)return bad('Boutique introuvable',404);
    if(String(b.confirm||'')!==shop.name)return bad('Confirmation incorrecte. Saisissez le nom exact de la boutique.');
    await prisma.shop.delete({where:{id}});
    return ok({ok:true});
  }catch(e:any){return bad(e.message,e.status||500)}
}
