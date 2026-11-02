import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad, ok } from '@/lib/http';
import { SubscriptionRequestStatus, UserRole } from '@prisma/client';
import { activatePaidRequest, platformKonnectInit, platformKonnectReady } from '@/lib/platform-konnect';

// Démarre le paiement en ligne d'une offre : une demande « KONNECT » est créée puis activée
// automatiquement dès que Konnect confirme le paiement (webhook ou retour sur la page).
export async function POST(req: Request) {
  try {
    const s = await requireSession([UserRole.ADMIN], 'CONNECT');
    if (!platformKonnectReady()) return bad('Le paiement en ligne n’est pas encore disponible. Utilisez D17 ou le virement.', 409);
    const b = await req.json().catch(() => ({}));
    const plan = await prisma.plan.findFirst({ where: { id: String(b.planId || ''), active: true } });
    if (!plan) return bad('Offre introuvable', 404);
    if (plan.code === 'CONNECT' || Number(plan.price) <= 0) return bad('Cette offre est gratuite', 409);
    const shop = await prisma.shop.findUniqueOrThrow({ where: { id: s.shopId }, select: { id: true, tenantId: true, name: true, phone: true, email: true } });
    const pending = await prisma.subscriptionRequest.count({ where: { shopId: shop.id, status: SubscriptionRequestStatus.PENDING, paymentMethod: 'KONNECT', createdAt: { gte: new Date(Date.now() - 3600_000) } } });
    if (pending >= 5) return bad('Plusieurs paiements sont déjà en cours. Réessayez dans une heure.', 429);
    const x = await prisma.subscriptionRequest.create({ data: { tenantId: shop.tenantId, shopId: shop.id, planId: plan.id, requestedPrice: plan.price, durationValue: plan.durationValue, durationUnit: plan.durationUnit, status: SubscriptionRequestStatus.PENDING, paymentMethod: 'KONNECT', note: 'Paiement en ligne' } });
    const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    try {
      const pay = await platformKonnectInit({ amount: Number(plan.price), description: `Abonnement Fixi ${plan.name} · ${shop.name}`, orderId: x.id, webhook: `${base}/api/subscription-center/konnect`, successUrl: `${base}/app/subscription?paid=1`, failUrl: `${base}/app/subscription?paid=0`, firstName: shop.name, phone: shop.phone || '', email: shop.email || '' });
      await prisma.subscriptionRequest.update({ where: { id: x.id }, data: { transferReference: pay.paymentRef } });
      return ok({ payUrl: pay.payUrl });
    } catch (e) {
      await prisma.subscriptionRequest.update({ where: { id: x.id }, data: { status: SubscriptionRequestStatus.REJECTED, adminNote: 'Paiement en ligne non démarré' } }).catch(() => {});
      throw e;
    }
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

// Retour sur la page après paiement : vérifie tout de suite sans attendre le webhook.
export async function PUT(req: Request) {
  try {
    const s = await requireSession([UserRole.ADMIN], 'CONNECT');
    const b = await req.json().catch(() => ({}));
    const ref = String(b.paymentRef || '');
    // Sans référence dans l'adresse de retour : on vérifie le dernier paiement en ligne de l'atelier.
    const own = await prisma.subscriptionRequest.findFirst({ where: { shopId: s.shopId, paymentMethod: 'KONNECT', ...(ref ? { transferReference: ref } : { status: SubscriptionRequestStatus.PENDING, transferReference: { not: null } }) }, orderBy: { createdAt: 'desc' }, select: { transferReference: true } });
    if (!own?.transferReference) return bad('Paiement introuvable', 404);
    return ok(await activatePaidRequest(own.transferReference));
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
