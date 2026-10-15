import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { bad,ok } from '@/lib/http';
import { createPlatformSession } from '@/lib/platform-auth';

export async function POST(req:Request){
  try{
    const b=await req.json();
    const login=String(b.login||'').trim().toLowerCase();
    const password=String(b.password||'');
    const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'local';
    const keyHash=crypto.createHash('sha256').update(`platform:${ip}:${login}`).digest('hex');
    const now=new Date();
    const guard=await prisma.loginGuard.findUnique({where:{keyHash}});
    if(guard&&guard.resetAt>now&&guard.count>=8)return bad('Trop de tentatives. Réessayez plus tard.',429);
    const admin=login?await prisma.platformAdmin.findUnique({where:{login}}):null;
    const valid=!!admin&&admin.isActive&&await bcrypt.compare(password,admin.passwordHash);
    if(!valid||!admin){
      const active=guard&&guard.resetAt>now;
      const count=(active?guard.count:0)+1;
      const resetAt=new Date(Date.now()+15*60_000);
      await prisma.loginGuard.upsert({where:{keyHash},update:{count,resetAt},create:{keyHash,count,resetAt}});
      return bad('Identifiants incorrects',401);
    }
    if(guard)await prisma.loginGuard.delete({where:{keyHash}}).catch(()=>{});
    await createPlatformSession({id:admin.id,login:admin.login,fullName:admin.fullName});
    return ok({ok:true});
  }catch(e:any){return bad(e.message,e.status||500)}
}
