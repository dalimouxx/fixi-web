import { prisma } from '@/lib/prisma';
import { requirePlatformSession } from '@/lib/platform-auth';
import { bad, ok } from '@/lib/http';

export const dynamic = 'force-dynamic';

// Écrans réellement utilisés par les boutiques sur les N derniers jours.
export async function GET(req: Request) {
  try {
    await requirePlatformSession();
    const days = Math.min(90, Math.max(1, Number(new URL(req.url).searchParams.get('days') || 30)));
    const since = new Date(Date.now() - days * 86400000);
    const [byPath, shopsByPath, modes, activeShops] = await Promise.all([
      prisma.usageEvent.groupBy({ by: ['path'], where: { createdAt: { gte: since } }, _count: { _all: true }, orderBy: { _count: { path: 'desc' } }, take: 60 }),
      prisma.usageEvent.groupBy({ by: ['path', 'shopId'], where: { createdAt: { gte: since } } }),
      prisma.usageEvent.groupBy({ by: ['uiMode'], where: { createdAt: { gte: since } }, _count: { _all: true } }),
      prisma.usageEvent.groupBy({ by: ['shopId'], where: { createdAt: { gte: since } } }),
    ]);
    const shopCount = new Map<string, number>();
    for (const row of shopsByPath) shopCount.set(row.path, (shopCount.get(row.path) || 0) + 1);
    return ok({
      days,
      activeShops: activeShops.length,
      modes: Object.fromEntries(modes.map(m => [m.uiMode || 'simple', m._count._all])),
      screens: byPath.map(r => ({ path: r.path, views: r._count._all, shops: shopCount.get(r.path) || 0 })),
    });
  } catch (e: any) {
    return bad(e.message, e.status || 500);
  }
}
