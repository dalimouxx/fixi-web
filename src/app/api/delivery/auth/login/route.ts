import bcrypt from 'bcryptjs';
import {prisma} from '@/lib/prisma';
import {bad,ok} from '@/lib/http';
import {createDeliverySession} from '@/lib/delivery-auth';

export async function POST(req:Request){try{
 const b=await req.json();const login=String(b.login||'').toLowerCase();
 const a=await prisma.supplierAccount.findUnique({where:{login},include:{company:true}});
 if(!a||!a.isActive||!a.company.active||a.role!=='DRIVER'||!await bcrypt.compare(String(b.password||''),a.passwordHash))return bad('Identifiants livreur invalides',401);
 await createDeliverySession({id:a.id,companyId:a.companyId,fullName:a.fullName,companyName:a.company.name,role:a.role,sessionVersion:a.deliverySessionVersion});
 return ok({ok:true});
}catch(e:any){return bad(e.message,e.status||500)}}
