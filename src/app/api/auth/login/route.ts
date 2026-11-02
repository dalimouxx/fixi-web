import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { createSession, roleLabels } from '@/lib/auth';
import { bad, ok } from '@/lib/http';
import { loginSchema } from '@/lib/validators';
import { audit } from '@/lib/audit';
import { resolveFixiAccess } from '@/lib/freemium';
import { loginGuard, TOO_MANY } from '@/lib/login-guard';

export async function POST(req: Request) {
  try {
    const body = loginSchema.parse(await req.json());
    const slug = body.shopSlug;
    const guard = loginGuard('atelier', req, `${slug}:${body.userId || body.loginCode}`);
    if (await guard.blocked()) return bad(TOO_MANY, 429);
    const shop = await prisma.shop.findFirst({ where: { slug, isActive: true } });
    const u = !shop ? null : body.userId
      ? await prisma.user.findFirst({ where: { id: body.userId, shopId: shop.id }, include: { shop: true } })
      : await prisma.user.findUnique({ where: { shopId_loginCode: { shopId: shop.id, loginCode: String(body.loginCode).toLowerCase() } }, include: { shop: true } });
    const valid = !!u && u.isActive && await bcrypt.compare(body.pin, u.pinHash);
    if (!valid || !u) { await guard.fail(); return bad('Identifiant ou code PIN incorrect', 401); }
    await guard.success();
    const seenAt = new Date();
    await prisma.$transaction([prisma.shop.update({ where: { id: u.shopId }, data: { lastSeenAt: seenAt, lastLoginAt: seenAt } }), prisma.user.update({ where: { id: u.id }, data: { lastSeenAt: seenAt } })]);
    await createSession({ id: u.id, shopId: u.shopId, tenantId: u.shop.tenantId, role: u.role, fullName: u.fullName, shopName: u.shop.name, shopSlug: u.shop.slug });
    await audit(u.shopId, u.id, 'LOGIN', 'USER', u.id, { ip: guard.ip });
    const latest = await prisma.subscription.findFirst({ where: { tenantId: u.shop.tenantId }, orderBy: { createdAt: 'desc' }, include: { plan: { select: { code: true } } } });
    return ok({ id: u.id, fullName: u.fullName, role: u.role, roleLabel: roleLabels[u.role], mustChangePin: u.mustChangePin, accessTier: resolveFixiAccess(latest) });
  } catch (e: any) {
    if (e?.issues) return bad('Données de connexion invalides');
    return bad(e?.message || 'Connexion impossible', e?.status || 500);
  }
}
