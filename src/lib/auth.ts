import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { prisma } from './prisma';
import { UserRole } from '@prisma/client';
import { resolveFixiAccess, type FixiAccessTier } from './freemium';
const COOKIE='fixi_session';
const secret=()=>{const v=process.env.AUTH_SECRET;if(!v&&process.env.NODE_ENV==='production')throw new Error('AUTH_SECRET manquant');return new TextEncoder().encode(v||'dev-secret-change-this-immediately-123456')};
export type SessionUser={ id:string; shopId:string; tenantId:string; role:UserRole; fullName:string; shopName:string; shopSlug:string; };
export async function createSession(user: SessionUser) {const token=await new SignJWT(user).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('12h').sign(secret());const c=await cookies(); c.set(COOKIE,token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:60*60*12});}
export async function destroySession(){ const c=await cookies(); c.set(COOKIE,'',{httpOnly:true,path:'/',maxAge:0}); }
export async function getSession():Promise<SessionUser|null>{const c=await cookies(); const token=c.get(COOKIE)?.value; if(!token) return null;try { const {payload}=await jwtVerify(token,secret()); return payload as unknown as SessionUser; } catch { return null; }}
export async function requireSession(roles?: UserRole[], minimumAccess: FixiAccessTier = 'PRO') {
  const s=await getSession();
  if(!s)throw Object.assign(new Error('UNAUTHENTICATED'),{status:401});
  const [user,shop,sub]=await Promise.all([
    prisma.user.findFirst({where:{id:s.id,shopId:s.shopId,isActive:true}}),
    prisma.shop.findFirst({where:{id:s.shopId,tenantId:s.tenantId,isActive:true},select:{id:true}}),
    prisma.subscription.findFirst({where:{tenantId:s.tenantId},orderBy:{createdAt:'desc'},
      include:{plan:{select:{code:true,name:true}}}}),
  ]);
  if(!user||!shop)throw Object.assign(new Error('UNAUTHENTICATED'),{status:401});
  if(roles&&!roles.includes(user.role))throw Object.assign(new Error('FORBIDDEN'),{status:403});
  const accessTier=resolveFixiAccess(sub);
  if(minimumAccess==='PRO'&&accessTier!=='PRO')
    throw Object.assign(new Error('MODULE_PREMIUM_REQUIS'),{status:403});
  return {...s,role:user.role,accessTier,planName:accessTier==='CONNECT'?'Fixi Connect':sub?.plan.name||'Fixi Pro'};
}
export const roleLabels:Record<UserRole,string>={ADMIN:'Gérant',RECEPTION:'Réception',TECHNICIAN:'Technicien',CASHIER:'Caissier'};
