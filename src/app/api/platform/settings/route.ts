import { prisma } from '@/lib/prisma';import { requirePlatformSession } from '@/lib/platform-auth';import { bad,ok } from '@/lib/http';import { plain } from '@/lib/serializers';
export async function GET(){try{await requirePlatformSession();const s=await prisma.platformSettings.upsert({where:{id:'platform'},update:{},create:{id:'platform'}});return ok(plain(s))}catch(e:any){return bad(e.message,e.status||500)}}
export async function PUT(req:Request){try{await requirePlatformSession();const b=await req.json();const data:any={};for(const k of ['appName','logoDataUrl','primaryColor','supportEmail','supportPhone','landingHeadline','landingSubheadline','queueAdsEnabled','trackingAdsEnabled','paymentD17Phone','paymentBankName','paymentBankRib','paymentInstructions'])if(b[k]!==undefined)data[k]=b[k];if(data.logoDataUrl&&String(data.logoDataUrl).length>2_000_000)return bad('Logo trop volumineux');if(data.primaryColor&&!/^#[0-9a-fA-F]{6}$/.test(data.primaryColor))return bad('Couleur invalide');
for(const [key,max] of Object.entries({paymentD17Phone:35,paymentBankName:120,paymentBankRib:140,paymentInstructions:1200})){
  if(data[key]!==undefined){
    const value=String(data[key]??'').trim();
    if(value.length>max)return bad('Champ de paiement trop long : '+key,400);
    data[key]=value||null;
  }
}const s=await prisma.platformSettings.upsert({where:{id:'platform'},update:data,create:{id:'platform',...data}});return ok(plain(s))}catch(e:any){return bad(e.message,e.status||500)}}
