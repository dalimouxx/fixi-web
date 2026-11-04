import { SubscriptionStatus, UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad, ok } from '@/lib/http';
import { audit } from '@/lib/audit';
import { pickTrialPlan, trialEligible } from '@/lib/growth';

export const dynamic = 'force-dynamic';

async function offer() {
  const plans = await prisma.plan.findMany({ where: { active: true, publicVisible: true }, select: { id: true, code: true, name: true, active: true, publicVisible: true, trialDays: true, price: true, durationValue: true, durationUnit: true } });
  return pickTrialPlan(plans.map(p => ({ ...p, price: Number(p.price) })));
}

/** Essai Fixi Pro en un clic : une seule fois par atelier, sans paiement, retour automatique à l'offre gratuite. */
export async function GET() {
  try {
    const s = await requireSession(undefined, 'CONNECT');
    const subs = await prisma.subscription.findMany({ where: { tenantId: s.tenantId }, select: { status: true, plan: { select: { code: true } } } });
    const o = await offer();
    return ok({ eligible: s.accessTier === 'CONNECT' && trialEligible(subs) && !!o, planName: o?.plan.name || null, days: o?.days || 0 });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

export async function POST() {
  try {
    const s = await requireSession([UserRole.ADMIN], 'CONNECT');
    const o = await offer();
    if (!o) return bad('Aucune offre Pro disponible pour l’essai', 404);
    const sub = await prisma.$transaction(async tx => {
      const subs = await tx.subscription.findMany({ where: { tenantId: s.tenantId }, select: { status: true, plan: { select: { code: true } } } });
      if (!trialEligible(subs)) throw Object.assign(new Error('L’essai gratuit a déjà été utilisé pour cet atelier'), { status: 409 });
      return tx.subscription.create({ data: { tenantId: s.tenantId, planId: o.plan.id, status: SubscriptionStatus.TRIAL, endsAt: new Date(Date.now() + o.days * 86400_000), agreedPrice: 0 } });
    });
    await audit(s.shopId, s.id, 'TRIAL_START', 'SUBSCRIPTION', sub.id, { plan: o.plan.code, days: o.days }).catch(() => {});
    return ok({ planName: o.plan.name, days: o.days, endsAt: sub.endsAt }, { status: 201 });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
