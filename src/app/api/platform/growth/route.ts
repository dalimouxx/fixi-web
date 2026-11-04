import { prisma } from '@/lib/prisma';
import { requirePlatformSession } from '@/lib/platform-auth';
import { bad, ok } from '@/lib/http';
import { dailySeries, monthlyPrice, relanceText } from '@/lib/growth';
import { waLink } from '@/lib/whatsapp-link';

export const dynamic = 'force-dynamic';
const DAY = 86400_000;

/** Croissance : inscriptions, activation, inactifs, essais, revenu mensuel. */
export async function GET() {
  try {
    await requirePlatformSession();
    const now = new Date(), d30 = new Date(now.getTime() - 30 * DAY), d7 = new Date(now.getTime() - 7 * DAY);
    const [settings, tenants, subs, orderShops, suppliers] = await Promise.all([
      prisma.platformSettings.findUnique({ where: { id: 'platform' }, select: { appName: true } }),
      prisma.tenant.findMany({ select: { id: true, name: true, createdAt: true, shops: { where: { isActive: true }, select: { id: true, name: true, region: true, phone: true, lastSeenAt: true, createdAt: true }, take: 1, orderBy: { createdAt: 'asc' } } } }),
      prisma.subscription.findMany({ select: { tenantId: true, status: true, endsAt: true, agreedPrice: true, createdAt: true, updatedAt: true, plan: { select: { code: true, name: true, price: true, durationValue: true, durationUnit: true } } }, orderBy: { createdAt: 'desc' } }),
      prisma.supplierOrder.groupBy({ by: ['shopId'], _count: { _all: true }, _min: { createdAt: true } }),
      prisma.supplierCompany.count({ where: { createdAt: { gte: d30 } } }).catch(() => 0),
    ]);
    const app = settings?.appName || 'Fixi';
    const latest = new Map<string, (typeof subs)[number]>();
    for (const s of subs) if (!latest.has(s.tenantId)) latest.set(s.tenantId, s);
    const ordersBy = new Map(orderShops.map(o => [o.shopId, o]));
    const paid = (s?: (typeof subs)[number]) => !!s && !!s.plan && s.plan.code.toUpperCase() !== 'CONNECT';
    const live = (s?: (typeof subs)[number]) => !!s && (s.status === 'ACTIVE' || s.status === 'TRIAL') && (!s.endsAt || s.endsAt > now);

    const rows = tenants.filter(t => t.shops[0]).map(t => {
      const shop = t.shops[0], sub = latest.get(t.id), o = ordersBy.get(shop.id);
      const tier = paid(sub) && live(sub) ? (sub!.status === 'TRIAL' ? 'TRIAL' : 'PRO') : 'CONNECT';
      return { tenantId: t.id, shopId: shop.id, name: shop.name, region: shop.region, phone: shop.phone, createdAt: t.createdAt, lastSeenAt: shop.lastSeenAt, orders: o?._count._all || 0, firstOrderAt: o?._min.createdAt || null, tier, trialEndsAt: sub?.status === 'TRIAL' ? sub.endsAt : null };
    });
    const recent = rows.filter(r => r.createdAt >= d30);
    const activated = recent.filter(r => r.firstOrderAt && r.firstOrderAt.getTime() - r.createdAt.getTime() <= 7 * DAY).length;
    const regions = Object.entries(recent.reduce<Record<string, number>>((a, r) => { a[r.region] = (a[r.region] || 0) + 1; return a; }, {})).map(([region, count]) => ({ region, count })).sort((a, b) => b.count - a.count);

    let mrr = 0, paying = 0;
    for (const [, s] of latest) if (paid(s) && live(s) && s.status === 'ACTIVE') { paying++; mrr += monthlyPrice(Number(s.agreedPrice ?? s.plan!.price), s.plan!.durationValue, s.plan!.durationUnit); }
    const lost = [...latest.values()].filter(s => paid(s) && s.status !== 'TRIAL' && ((s.endsAt && s.endsAt <= now && s.endsAt >= d30) || (['CANCELLED', 'SUSPENDED'].includes(s.status) && s.updatedAt >= d30))).length;

    const withWa = (r: (typeof rows)[number], kind: 'welcome' | 'inactive' | 'trial') => ({ ...r, wa: r.phone ? waLink(r.phone, relanceText(kind, r.name, app)) : null });
    return ok({
      kpis: {
        signups30: recent.length, signups7: recent.filter(r => r.createdAt >= d7).length, suppliers30: suppliers,
        activationPct: recent.length ? Math.round(activated / recent.length * 100) : 0, activated,
        mrr: Math.round(mrr * 1000) / 1000, paying, trials: rows.filter(r => r.tier === 'TRIAL').length, lost30: lost,
        conversionPct: rows.length ? Math.round(rows.filter(r => r.tier === 'PRO').length / rows.length * 100) : 0,
      },
      series: dailySeries(recent.map(r => r.createdAt), 30, now),
      regions,
      newcomers: recent.sort((a, b) => +b.createdAt - +a.createdAt).slice(0, 20).map(r => withWa(r, 'welcome')),
      inactive: rows.filter(r => r.createdAt < d7 && (!r.lastSeenAt || r.lastSeenAt < d7)).sort((a, b) => +(b.lastSeenAt || b.createdAt) - +(a.lastSeenAt || a.createdAt)).slice(0, 30).map(r => withWa(r, 'inactive')),
      trialsEnding: rows.filter(r => r.trialEndsAt && r.trialEndsAt > now && r.trialEndsAt.getTime() - now.getTime() <= 3 * DAY).map(r => withWa(r, 'trial')),
    });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
