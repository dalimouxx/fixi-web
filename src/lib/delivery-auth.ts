import {SignJWT,jwtVerify} from 'jose';
import {cookies} from 'next/headers';
import {prisma} from './prisma';

const COOKIE='fixi_delivery_session';
const secret=()=>new TextEncoder().encode(process.env.DELIVERY_AUTH_SECRET||process.env.SUPPLIER_AUTH_SECRET||process.env.AUTH_SECRET||'dev-delivery-secret-change-me-123456789');

export type DeliverySession={id:string;companyId:string;fullName:string;companyName:string;role:string;sessionVersion:number};

export async function createDeliverySession(v:DeliverySession){
 const token=await new SignJWT(v).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('24h').sign(secret());
 const c=await cookies();c.set(COOKIE,token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:86400});
}
export async function destroyDeliverySession(){const c=await cookies();c.set(COOKIE,'',{httpOnly:true,path:'/',maxAge:0})}
export async function getDeliverySession():Promise<DeliverySession|null>{const c=await cookies();const t=c.get(COOKIE)?.value;if(!t)return null;try{const{payload}=await jwtVerify(t,secret());return payload as unknown as DeliverySession}catch{return null}}
export async function requireDeliverySession(){
 const s=await getDeliverySession();if(!s)throw Object.assign(new Error('UNAUTHENTICATED'),{status:401});
 const a=await prisma.supplierAccount.findFirst({where:{id:s.id,companyId:s.companyId,isActive:true,role:'DRIVER'},include:{company:true}});
 if(!a||!a.company.active||a.deliverySessionVersion!==s.sessionVersion)throw Object.assign(new Error('UNAUTHENTICATED'),{status:401});
 return s;
}
