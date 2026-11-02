import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { bad,ok } from '@/lib/http';
import { createPlatformSession } from '@/lib/platform-auth';
import { loginGuard,TOO_MANY } from '@/lib/login-guard';

export async function POST(req:Request){
  try{
    const b=await req.json();
    const login=String(b.login||'').trim().toLowerCase();
    const password=String(b.password||'');
    const guard=loginGuard('platform',req,login);
    if(await guard.blocked())return bad(TOO_MANY,429);
    const admin=login?await prisma.platformAdmin.findUnique({where:{login}}):null;
    const valid=!!admin&&admin.isActive&&await bcrypt.compare(password,admin.passwordHash);
    if(!valid||!admin){await guard.fail();return bad('Identifiants incorrects',401)}
    await guard.success();
    await createPlatformSession({id:admin.id,login:admin.login,fullName:admin.fullName});
    return ok({ok:true});
  }catch(e:any){return bad(e.message,e.status||500)}
}
