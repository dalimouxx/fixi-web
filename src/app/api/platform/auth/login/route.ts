import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { bad,ok } from '@/lib/http';
import { createPlatformSession } from '@/lib/platform-auth';
import { loginGuard,TOO_MANY } from '@/lib/login-guard';
import { cookies } from 'next/headers';
import { verifyTotp } from '@/lib/totp';
import { checkTrust,issueTrust,TOTP_REQUIRED,TRUST_DAYS } from '@/lib/two-factor';

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
    if(admin.totpEnabled){
      const jar=await cookies();
      if(!await checkTrust(jar.get('fixi_trust_platform')?.value,'platform',admin.id,admin.sessionVersion)){
        if(!b.totp)return Response.json({error:TOTP_REQUIRED,needsTotp:true},{status:401});
        if(!verifyTotp(admin.totpSecret,b.totp)){await guard.fail();return Response.json({error:'Code de vérification incorrect',needsTotp:true},{status:401})}
        jar.set('fixi_trust_platform',await issueTrust('platform',admin.id,admin.sessionVersion),{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:TRUST_DAYS*86400});
      }
    }
    await guard.success();
    await createPlatformSession({id:admin.id,login:admin.login,fullName:admin.fullName,sv:admin.sessionVersion});
    return ok({ok:true});
  }catch(e:any){return bad(e.message,e.status||500)}
}
