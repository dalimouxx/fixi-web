import {SignJWT,jwtVerify} from 'jose';
import {cookies} from 'next/headers';
import {prisma} from './prisma';

const COOKIE='fixi_supplier_session';
const secret=()=>new TextEncoder().encode(process.env.SUPPLIER_AUTH_SECRET||process.env.AUTH_SECRET||'dev-supplier-secret-change-me-123456789');

export const supplierRoles=['OWNER','ADMIN','MANAGER','STOCK','SALES','CASHIER','ACCOUNTANT','DELIVERY_MANAGER','DRIVER'] as const;
export type SupplierRole=(typeof supplierRoles)[number];
export type SupplierSession={id:string;companyId:string;fullName:string;companyName:string;role:SupplierRole};

export async function createSupplierSession(v:SupplierSession){
 const t=await new SignJWT(v).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('12h').sign(secret());
 const c=await cookies();c.set(COOKIE,t,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:43200});
}
export async function destroySupplierSession(){const c=await cookies();c.set(COOKIE,'',{httpOnly:true,path:'/',maxAge:0})}
export async function getSupplierSession():Promise<SupplierSession|null>{
 const c=await cookies();const t=c.get(COOKIE)?.value;if(!t)return null;
 try{const{payload}=await jwtVerify(t,secret());return payload as unknown as SupplierSession}catch{return null}
}
export async function requireSupplierSession(){
 const s=await getSupplierSession();if(!s)throw Object.assign(new Error('UNAUTHENTICATED'),{status:401});
 const a=await prisma.supplierAccount.findFirst({where:{id:s.id,companyId:s.companyId,isActive:true},include:{company:true}});
 if(!a||!a.company.active)throw Object.assign(new Error('UNAUTHENTICATED'),{status:401});
 return {...s,role:(a.role||'ADMIN') as SupplierRole,companyName:a.company.name};
}
export async function requireSupplierRole(allowed:readonly SupplierRole[]){
 const s=await requireSupplierSession();
 if(!allowed.includes(s.role))throw Object.assign(new Error('FORBIDDEN'),{status:403});
 return s;
}
export const canManageSupplier=(role:string)=>['OWNER','ADMIN','MANAGER'].includes(role);
