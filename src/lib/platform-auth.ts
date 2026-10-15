import { SignJWT,jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { prisma } from './prisma';
const COOKIE='fixi_platform_session';
const secret=()=>{
  const v=process.env.PLATFORM_AUTH_SECRET;
  if(!v&&process.env.NODE_ENV==='production')throw new Error('PLATFORM_AUTH_SECRET manquant');
  return new TextEncoder().encode(v||'dev-platform-secret-change-now-123456789');
};
export type PlatformSession={id:string;login:string;fullName:string};
export async function createPlatformSession(v:PlatformSession){const t=await new SignJWT(v).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('8h').sign(secret());const c=await cookies();c.set(COOKIE,t,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:28800});}
export async function destroyPlatformSession(){const c=await cookies();c.set(COOKIE,'',{httpOnly:true,path:'/',maxAge:0});}
export async function getPlatformSession():Promise<PlatformSession|null>{const c=await cookies();const t=c.get(COOKIE)?.value;if(!t)return null;try{const {payload}=await jwtVerify(t,secret());return payload as unknown as PlatformSession}catch{return null}}
export async function requirePlatformSession(){const s=await getPlatformSession();if(!s)throw Object.assign(new Error('UNAUTHENTICATED'),{status:401});const a=await prisma.platformAdmin.findFirst({where:{id:s.id,isActive:true}});if(!a)throw Object.assign(new Error('UNAUTHENTICATED'),{status:401});return s;}
