import bcrypt from 'bcryptjs';
import {createHash} from 'crypto';
import {prisma} from '@/lib/prisma';
import {bad,ok} from '@/lib/http';
import {createDeliverySession} from '@/lib/delivery-auth';

const guardKey=(login:string)=>createHash('sha256').update('delivery:'+login).digest('hex');

export async function POST(req:Request){try{
 const b=await req.json();const login=String(b.login||'').trim().toLowerCase();const keyHash=guardKey(login);
 const now=new Date();const guard=await prisma.loginGuard.findUnique({where:{keyHash}});
 if(guard&&guard.resetAt>now&&guard.count>=5)return bad('Trop de tentatives. Réessayez dans quelques minutes.',429);
 if(guard&&guard.resetAt<=now)await prisma.loginGuard.delete({where:{keyHash}}).catch(()=>{});
 const a=await prisma.supplierAccount.findUnique({where:{login},include:{company:true}});
 const valid=!!(a&&a.isActive&&a.company.active&&a.role==='DRIVER'&&await bcrypt.compare(String(b.password||''),a.passwordHash));
 if(!valid){
  const resetAt=new Date(Date.now()+15*60*1000);
  await prisma.loginGuard.upsert({where:{keyHash},update:{count:{increment:1},resetAt},create:{keyHash,count:1,resetAt}});
  return bad('Identifiants livreur invalides',401);
 }
 await prisma.loginGuard.deleteMany({where:{keyHash}});
 await createDeliverySession({id:a!.id,companyId:a!.companyId,fullName:a!.fullName,companyName:a!.company.name,role:a!.role,sessionVersion:a!.deliverySessionVersion});
 await prisma.supplierAuditEvent.create({data:{companyId:a!.companyId,accountId:a!.id,action:'DELIVERY_LOGIN',entity:'SUPPLIER_ACCOUNT',entityId:a!.id,metadata:{userAgent:req.headers.get('user-agent')||null}}}).catch(()=>{});
 return ok({ok:true});
}catch(e:any){return bad(e.message,e.status||500)}}