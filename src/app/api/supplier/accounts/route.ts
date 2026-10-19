import bcrypt from 'bcryptjs';
import {prisma} from '@/lib/prisma';
import {requireSupplierRole} from '@/lib/supplier-auth';
import {bad,ok} from '@/lib/http';
import {plain} from '@/lib/serializers';
import {requireSupplierCreationCapacity} from '@/lib/supplier-saas';

const roles=['OWNER','ADMIN','MANAGER','STOCK','SALES','CASHIER','ACCOUNTANT','DELIVERY_MANAGER'] as const;

export async function GET(){
 try{
  const s=await requireSupplierRole(['OWNER','ADMIN','MANAGER']);
  const rows=await prisma.supplierAccount.findMany({where:{companyId:s.companyId,role:{not:'DRIVER'}},select:{id:true,fullName:true,login:true,phone:true,role:true,isActive:true,createdAt:true},orderBy:[{isActive:'desc'},{fullName:'asc'}]});
  return ok(plain(rows));
 }catch(e:any){return bad(e.message,e.status||500)}
}

export async function POST(req:Request){
 try{
  const s=await requireSupplierRole(['OWNER','ADMIN']);
  const b=await req.json(),login=String(b.login||'').trim().toLowerCase(),password=String(b.password||''),role=String(b.role||'');
  if(!String(b.fullName||'').trim()||!login||password.length<6||!roles.includes(role as any))return bad('Nom, identifiant, rôle et mot de passe (6 caractères minimum) requis');
  if(role==='OWNER'&&s.role!=='OWNER')return bad('Seul le propriétaire peut créer un autre propriétaire',403);
  await requireSupplierCreationCapacity(s.companyId,'STAFF');
  const a=await prisma.supplierAccount.create({data:{companyId:s.companyId,fullName:String(b.fullName).trim(),login,passwordHash:await bcrypt.hash(password,10),role,phone:String(b.phone||'').trim()||null,isActive:true}});
  await prisma.supplierAuditEvent.create({data:{companyId:s.companyId,accountId:s.id,action:'CREATE',entity:'ACCOUNT',entityId:a.id,metadata:{fullName:a.fullName,login:a.login,role:a.role}}});
  return ok(plain({id:a.id,fullName:a.fullName,login:a.login,phone:a.phone,role:a.role,isActive:a.isActive}),{status:201});
 }catch(e:any){if(e.code==='P2002')return bad('Identifiant déjà utilisé',409);return bad(e.message,e.status||500)}
}

export async function PATCH(req:Request){
 try{
  const s=await requireSupplierRole(['OWNER','ADMIN']);const b=await req.json(),id=String(b.id||'');
  if(id===s.id&&b.isActive===false)return bad('Vous ne pouvez pas désactiver votre propre compte',409);
  const a=await prisma.supplierAccount.findFirst({where:{id,companyId:s.companyId,role:{not:'DRIVER'}}});if(!a)return bad('Compte introuvable',404);
  if(a.role==='OWNER'&&s.role!=='OWNER')return bad('Compte propriétaire protégé',403);
  const data:any={};
  if(b.fullName!==undefined)data.fullName=String(b.fullName).trim();
  if(b.phone!==undefined)data.phone=String(b.phone||'').trim()||null;
  if(b.role!==undefined){const role=String(b.role);if(!roles.includes(role as any))return bad('Rôle invalide');if(role==='OWNER'&&s.role!=='OWNER')return bad('Rôle propriétaire protégé',403);data.role=role}
  if(typeof b.isActive==='boolean')data.isActive=b.isActive;
  if(b.password!==undefined){const password=String(b.password);if(password.length<6)return bad('Mot de passe trop court');data.passwordHash=await bcrypt.hash(password,10)}
  const x=await prisma.supplierAccount.update({where:{id},data});
  await prisma.supplierAuditEvent.create({data:{companyId:s.companyId,accountId:s.id,action:'UPDATE',entity:'ACCOUNT',entityId:id,metadata:{role:x.role,isActive:x.isActive}}});
  return ok(plain({id:x.id,fullName:x.fullName,login:x.login,phone:x.phone,role:x.role,isActive:x.isActive}));
 }catch(e:any){return bad(e.message,e.status||500)}
}
