import { prisma } from '@/lib/prisma';
import { requirePlatformSession } from '@/lib/platform-auth';
import { bad, ok } from '@/lib/http';
import { plain } from '@/lib/serializers';
import { watchReasons } from '@/lib/watchlist';

/** Boutiques à appeler pendant le test réel : jamais configurées, inactives, sans réparations, abonnement, problèmes. */
export async function GET() {
  try {
    await requirePlatformSession();
    const since = new Date(Date.now() - 14 * 86400_000);
    const shops = await prisma.shop.findMany({ where: { isActive: true }, select: { id: true, name: true, region: true, phone: true, createdAt: true, setupCompletedAt: true, lastSeenAt: true, tenantId: true }, take: 500 });
    const ids = shops.map(s => s.id), tenants = [...new Set(shops.map(s => s.tenantId))];
    const [repairs, subs, problems] = await Promise.all([
      prisma.repair.groupBy({ by: ['shopId'], where: { shopId: { in: ids }, createdAt: { gte: since } }, _count: { _all: true } }),
      prisma.subscription.findMany({ where: { tenantId: { in: tenants } }, orderBy: { createdAt: 'desc' }, select: { tenantId: true, endsAt: true, status: true } }),
      prisma.problemReport.groupBy({ by: ['shopId'], where: { status: 'OPEN', shopId: { in: ids } }, _count: { _all: true } }),
    ]);
    const rep = new Map(repairs.map(r => [r.shopId, r._count._all]));
    const sub = new Map<string, Date | null>(); for (const x of subs) if (!sub.has(x.tenantId)) sub.set(x.tenantId, x.status === 'CANCELLED' ? null : x.endsAt);
    const prob = new Map(problems.map(p => [p.shopId || '', p._count._all]));
    const rows = shops.map(s => {
      const reasons = watchReasons({ id: s.id, createdAt: s.createdAt, setupCompletedAt: s.setupCompletedAt, lastSeenAt: s.lastSeenAt, repairs14d: rep.get(s.id) || 0, subEndsAt: sub.get(s.tenantId) || null, openProblems: prob.get(s.id) || 0 });
      return { id: s.id, name: s.name, region: s.region, phone: s.phone, lastSeenAt: s.lastSeenAt, reasons, score: reasons.reduce((a, r) => a + r.weight, 0) };
    }).filter(r => r.reasons.length).sort((a, b) => b.score - a.score).slice(0, 60);
    return ok(plain({ total: shops.length, rows }));
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
