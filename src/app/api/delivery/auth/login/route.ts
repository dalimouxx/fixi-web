import bcrypt from 'bcryptjs';
import {prisma} from '@/lib/prisma';
import {bad,ok} from '@/lib/http';
import {createDeliverySession} from '@/lib/delivery-auth';
import {loginGuard,TOO_MANY} from '@/lib/login-guard';

export async function POST(req:Request){try{
 const b=await req.json();const login=String(b.login||'').trim().toLowerCase();const guard=loginGuard('delivery',req,login);
 if(await guard.blocked())return bad(TOO_MANY,429);
 const a=await prisma.supplierAccount.findUnique({where:{login},include:{company:true}});
 const valid=!!(a&&a.isActive&&a.company.active&&a.role==='DRIVER'&&await bcrypt.compare(String(b.password||''),a.passwordHash));
 if(!valid){await guard.fail();return bad('Identifiants livreur invalides',401)}
 await guard.success();
 await createDeliverySession({id:a!.id,companyId:a!.companyId,fullName:a!.fullName,companyName:a!.company.name,role:a!.role,sessionVersion:a!.deliverySessionVersion});
 await prisma.supplierAuditEvent.create({data:{companyId:a!.companyId,accountId:a!.id,action:'DELIVERY_LOGIN',entity:'SUPPLIER_ACCOUNT',entityId:a!.id,metadata:{userAgent:req.headers.get('user-agent')||null}}}).catch(()=>{});
 return ok({ok:true});
}catch(e:any){return bad(e.message,e.status||500)}}