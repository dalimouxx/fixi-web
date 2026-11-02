import { prisma } from './prisma';
import { SubscriptionRequestStatus, SubscriptionStatus } from '@prisma/client';
import { addDuration } from './subscription-duration';

// Paiement de l'abonnement Fixi en ligne (carte, e-DINAR, wallet) via le compte Konnect de la plateforme.
// Inactif tant que KONNECT_PLATFORM_WALLET_ID et KONNECT_PLATFORM_API_KEY ne sont pas définis :
// le règlement manuel D17 / virement reste alors le seul proposé.
const apiBase = () => (process.env.KONNECT_PLATFORM_SANDBOX === 'false' ? 'https://api.konnect.network/api/v2' : 'https://api.sandbox.konnect.network/api/v2');

export function platformKonnectReady() {
  return !!(process.env.KONNECT_PLATFORM_WALLET_ID && process.env.KONNECT_PLATFORM_API_KEY);
}

export async function platformKonnectInit(input: { amount: number; description: string; orderId: string; webhook: string; successUrl: string; failUrl: string; firstName?: string; phone?: string; email?: string }) {
  if (!platformKonnectReady()) throw Object.assign(new Error('Paiement en ligne non disponible'), { status: 409 });
  const r = await fetch(`${apiBase()}/payments/init-payment`, {
    method: 'POST', headers: { 'x-api-key': String(process.env.KONNECT_PLATFORM_API_KEY), 'Content-Type': 'application/json' },
    body: JSON.stringify({ receiverWalletId: process.env.KONNECT_PLATFORM_WALLET_ID, token: 'TND', amount: Math.round(input.amount * 1000), type: 'immediate', description: input.description.slice(0, 280), acceptedPaymentMethods: ['wallet', 'bank_card', 'e-DINAR'], lifespan: 30, checkoutForm: true, addPaymentFeesToAmount: false, firstName: input.firstName || '', lastName: '', phoneNumber: input.phone || '', email: input.email || '', orderId: input.orderId, webhook: input.webhook, successUrl: input.successUrl, failUrl: input.failUrl, theme: 'light' }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.payUrl) throw Object.assign(new Error(j?.message || 'Impossible de créer le paiement'), { status: 502 });
  return { payUrl: String(j.payUrl), paymentRef: String(j.paymentRef) };
}

export async function platformKonnectGet(ref: string) {
  const r = await fetch(`${apiBase()}/payments/${encodeURIComponent(ref)}`, { headers: { 'x-api-key': String(process.env.KONNECT_PLATFORM_API_KEY) }, cache: 'no-store' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.message || 'Statut de paiement indisponible');
  return j.payment || j;
}

/** Montant payé (en dinars) d'après la réponse Konnect ; 0 si le paiement n'est pas terminé. */
export function paidAmount(p: any) {
  if (String(p?.status || '').toLowerCase() !== 'completed') return 0;
  const millimes = Number(p.reachedAmount || p.amount || 0);
  return Number.isFinite(millimes) ? millimes / 1000 : 0;
}

/**
 * Active l'abonnement d'une demande payée en ligne, une seule fois.
 * La nouvelle période commence à la fin de l'abonnement en cours s'il n'est pas encore terminé.
 */
export async function activatePaidRequest(ref: string) {
  if (!ref || !platformKonnectReady()) return { status: 'ignored' as const };
  const x = await prisma.subscriptionRequest.findFirst({ where: { transferReference: ref, paymentMethod: 'KONNECT' }, include: { plan: true } });
  if (!x || !x.plan) return { status: 'unknown' as const };
  if (x.status !== SubscriptionRequestStatus.PENDING) return { status: x.status === SubscriptionRequestStatus.APPROVED ? 'already' as const : 'closed' as const };
  const p = await platformKonnectGet(ref);
  if (String(p.orderId || x.id) !== x.id) return { status: 'mismatch' as const };
  const amount = paidAmount(p);
  const price = Number(x.requestedPrice ?? x.plan.price);
  if (!amount) return { status: 'pending' as const };
  if (amount < price - 0.001) return { status: 'underpaid' as const };
  const unit = x.durationUnit || x.plan.durationUnit;
  const value = x.durationValue || x.plan.durationValue || 1;
  return prisma.$transaction(async tx => {
    const u = await tx.subscriptionRequest.updateMany({ where: { id: x.id, status: SubscriptionRequestStatus.PENDING }, data: { status: SubscriptionRequestStatus.APPROVED, reviewedAt: new Date(), adminNote: 'Payé en ligne (Konnect) — activation automatique' } });
    if (!u.count) return { status: 'already' as const };
    const current = await tx.subscription.findFirst({ where: { tenantId: x.tenantId, status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] } }, orderBy: { endsAt: 'desc' } });
    const now = new Date();
    const startsAt = current?.status === SubscriptionStatus.ACTIVE && current.endsAt && current.endsAt > now && current.planId === x.planId ? current.endsAt : now;
    await tx.subscription.updateMany({ where: { tenantId: x.tenantId, status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] } }, data: { status: SubscriptionStatus.CANCELLED } });
    const sub = await tx.subscription.create({ data: { tenantId: x.tenantId, planId: x.plan!.id, status: SubscriptionStatus.ACTIVE, startsAt: now, endsAt: addDuration(startsAt, value, unit), agreedPrice: price, notes: 'Payé en ligne (Konnect)' } });
    await tx.saasPayment.create({ data: { tenantId: x.tenantId, amount, method: 'KONNECT', reference: ref.slice(0, 100), note: 'Abonnement payé en ligne', status: 'CONFIRMED' } });
    return { status: 'activated' as const, endsAt: sub.endsAt };
  });
}
