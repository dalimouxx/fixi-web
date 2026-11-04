import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad, ok } from '@/lib/http';
import { progress, startSteps, trialEligible } from '@/lib/growth';

export const dynamic = 'force-dynamic';

/** « Premiers pas » de l'atelier : calculé depuis ses vraies données, rien à cocher à la main. */
export async function GET() {
  try {
    const s = await requireSession(undefined, 'CONNECT');
    const [shop, ordered, delivered, invited, subs] = await Promise.all([
      prisma.shop.findUnique({ where: { id: s.shopId }, select: { address: true, city: true, phone: true, createdAt: true } }),
      prisma.supplierOrder.count({ where: { shopId: s.shopId } }),
      prisma.supplierOrder.count({ where: { shopId: s.shopId, status: 'DELIVERED' } }),
      prisma.supplierInvite.count({ where: { inviterShopId: s.shopId } }),
      prisma.subscription.findMany({ where: { tenantId: s.tenantId }, select: { status: true, plan: { select: { code: true } } } }),
    ]);
    const steps = startSteps({ hasAddress: !!(shop?.address && shop.phone), ordered: ordered > 0, delivered: delivered > 0, invited: invited > 0, pro: s.accessTier === 'PRO' });
    return ok({ steps, ...progress(steps), trialAvailable: s.accessTier === 'CONNECT' && trialEligible(subs), shop: { address: shop?.address || '', city: shop?.city || '', phone: shop?.phone || '' }, createdAt: shop?.createdAt });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
