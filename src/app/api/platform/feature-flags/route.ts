import { prisma } from '@/lib/prisma';
import { requirePlatformSession } from '@/lib/platform-auth';
import { bad,ok } from '@/lib/http';
import { plain } from '@/lib/serializers';

export async function GET(){
  try{
    await requirePlatformSession();
    const rows=await prisma.featureFlag.findMany({orderBy:{key:'asc'}});
    return ok(plain(rows));
  }catch(e:any){return bad(e.message,e.status||500)}
}

export async function POST(req:Request){
  try{
    await requirePlatformSession();
    const b=await req.json();
    if(!String(b.key||'').match(/^[A-Z0-9_]{3,60}$/))return bad('Clé invalide');
    const x=await prisma.featureFlag.upsert({
      where:{key:b.key},
      update:{label:b.label,description:b.description||null,enabled:!!b.enabled,shopIds:Array.isArray(b.shopIds)?b.shopIds:[],planCodes:Array.isArray(b.planCodes)?b.planCodes:[]},
      create:{key:b.key,label:b.label||b.key,description:b.description||null,enabled:!!b.enabled,shopIds:Array.isArray(b.shopIds)?b.shopIds:[],planCodes:Array.isArray(b.planCodes)?b.planCodes:[]}
    });
    return ok(plain(x));
  }catch(e:any){return bad(e.message,e.status||500)}
}
