import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad,ok } from '@/lib/http';
import { UserRole } from '@prisma/client';
import { plain } from '@/lib/serializers';

export async function GET(){
  try{
    const s=await requireSession([UserRole.ADMIN]);
    const rows=await prisma.referral.findMany({where:{referrerShopId:s.shopId},orderBy:{createdAt:'desc'}});
    return ok(plain(rows));
  }catch(e:any){return bad(e.message,e.status||500)}
}

export async function POST(req:Request){
  try{
    const s=await requireSession([UserRole.ADMIN]);
    const b=await req.json();
    if(String(b.referredTenantName||'').trim().length<2)return bad('Nom du réparateur / société requis');
    const x=await prisma.referral.create({data:{referrerShopId:s.shopId,referredTenantName:String(b.referredTenantName).trim(),contact:b.contact||null}});
    return ok(plain(x),{status:201});
  }catch(e:any){return bad(e.message,e.status||500)}
}
