import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { createSession, roleLabels } from '@/lib/auth';
import { bad, ok } from '@/lib/http';
import { loginSchema } from '@/lib/validators';
import { audit } from '@/lib/audit';
import { resolveFixiAccess } from '@/lib/freemium';

export async function POST(req: Request) {
  try {
    const body = loginSchema.parse(await req.json());
    const slug = body.shopSlug;
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
    const keyHash=crypto.createHash('sha256').update(`${ip}:${slug}:${body.loginCode.toLowerCase()}`).digest('hex');
    const now = new Date();
    const guard=await prisma.loginGuard.findUnique({where:{keyHash}});
    if(guard&&guard.resetAt>now&&guard.count>=5)return bad('Trop de tentatives. Réessayez dans quelques minutes.',429);
    const shop = await prisma.shop.findFirst({ where: { slug, isActive:true } });
    const u = shop ? await prisma.user.findUnique({ where: { shopId_loginCode: { shopId: shop.id, loginCode: body.loginCode.toLowerCase() } }, include: { shop: true } }) : null;
    const valid = !!u && u.isActive && await bcrypt.compare(body.pin, u.pinHash);
    if (!valid || !u) {
      const active=guard&&guard.resetAt>now;const count=(active?guard.count:0)+1;const resetAt=new Date(Date.now()+5*60_000);
      await prisma.loginGuard.upsert({where:{keyHash},update:{count,resetAt},create:{keyHash,count,resetAt}});
      return bad('Identifiant ou code PIN incorrect', 401);
    }
    if(guard)await prisma.loginGuard.delete({where:{keyHash}}).catch(()=>{});
    const seenAt=new Date();
    await prisma.$transaction([prisma.shop.update({where:{id:u.shopId},data:{lastSeenAt:seenAt,lastLoginAt:seenAt}}),prisma.user.update({where:{id:u.id},data:{lastSeenAt:seenAt}})]);
    await createSession({ id: u.id, shopId: u.shopId, tenantId: u.shop.tenantId, role: u.role, fullName: u.fullName, shopName: u.shop.name, shopSlug: u.shop.slug });
    await audit(u.shopId, u.id, 'LOGIN', 'USER', u.id, {ip});
    const latest=await prisma.subscription.findFirst({where:{tenantId:u.shop.tenantId},orderBy:{createdAt:'desc'},include:{plan:{select:{code:true}}}});
    return ok({ id: u.id, fullName: u.fullName, role: u.role, roleLabel: roleLabels[u.role],
      mustChangePin:u.mustChangePin,accessTier:resolveFixiAccess(latest) });
  } catch (e: any) {
    if (e?.issues) return bad('Données de connexion invalides');
    return bad(e?.message||'Connexion impossible', e?.status||500);
  }
}
