import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { SubscriptionStatus, UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { bad, ok } from '@/lib/http';
import { createSession } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { ensureConnectPlan } from '@/lib/freemium';
import { clientIp, TOO_MANY } from '@/lib/login-guard';
import { slugify, validateSignup } from '@/lib/signup';
import { whatsappWelcome } from '@/lib/platform-whatsapp';

const MAX_PER_IP = 3;          // créations réussies par adresse…
const WINDOW_H = 24;           // …sur 24 heures
const hash = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

/** Inscription libre d'un atelier : tenant + boutique + gérant + abonnement Fixi Connect gratuit. */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    if (body.website) return bad('Inscription refusée', 400); // champ piège invisible pour les robots
    const v = validateSignup(body);
    if (!v.ok) return bad(v.error, 400);
    const { shopName, region, city, fullName, phone, pin } = v.value;

    const key = hash(`signup:ip:${clientIp(req)}`);
    const now = new Date();
    const guard = await prisma.loginGuard.findUnique({ where: { keyHash: key } });
    const active = !!guard && guard.resetAt > now;
    if (active && guard!.count >= MAX_PER_IP) return bad(TOO_MANY, 429);

    const taken = await prisma.shop.findFirst({ where: { phone }, select: { id: true } });
    if (taken) return bad('Ce numéro a déjà un compte Fixi. Connectez-vous ou contactez le support.', 409);

    const base = slugify(shopName);
    let slug = base;
    for (let i = 2; await prisma.shop.findUnique({ where: { slug }, select: { id: true } }); i++) {
      slug = i < 50 ? `${base}-${i}` : `${base}-${crypto.randomBytes(3).toString('hex')}`;
    }

    const plan = await ensureConnectPlan();
    const pinHash = await bcrypt.hash(pin, 12);
    const { shop, user } = await prisma.$transaction(async tx => {
      const tenant = await tx.tenant.create({ data: { name: shopName } });
      // Inscription libre : pas encore vérifié (pas de catalogue fournisseurs avant validation dans Fixi Control).
      const shop = await tx.shop.create({ data: { tenantId: tenant.id, name: shopName, slug, region, city, phone, verificationStatus: 'NONE' } });
      const user = await tx.user.create({ data: { shopId: shop.id, fullName, loginCode: 'gerant', role: UserRole.ADMIN, pinHash, mustChangePin: false, lastSeenAt: now } });
      await tx.subscription.create({ data: { tenantId: tenant.id, planId: plan.id, status: SubscriptionStatus.ACTIVE, endsAt: null, agreedPrice: 0 } });
      return { tenant, shop, user };
    });

    await prisma.loginGuard.upsert({
      where: { keyHash: key },
      update: { count: active ? guard!.count + 1 : 1, resetAt: active ? guard!.resetAt : new Date(Date.now() + WINDOW_H * 3600_000) },
      create: { keyHash: key, count: 1, resetAt: new Date(Date.now() + WINDOW_H * 3600_000) },
    });
    await createSession({ id: user.id, shopId: shop.id, tenantId: shop.tenantId, role: user.role, fullName: user.fullName, shopName: shop.name, shopSlug: shop.slug });
    await audit(shop.id, user.id, 'SIGNUP', 'SHOP', shop.id, { plan: 'CONNECT', region }).catch(() => {});
    void whatsappWelcome(phone, shop.name); // jamais bloquant
    return ok({ shopSlug: shop.slug, userId: user.id, accessTier: 'CONNECT', next: '/app/suppliers' }, { status: 201 });
  } catch (e: any) {
    if (e?.code === 'P2002') return bad('Cette boutique existe déjà, réessayez avec un autre nom.', 409);
    return bad('Inscription impossible pour le moment', 500);
  }
}
