import { CashSessionStatus, PaymentKind, PaymentMethod, RepairStatus } from '@prisma/client';
import { prisma } from './prisma';

/** Date du jour à Tunis (AAAA-MM-JJ) et heure locale : le serveur peut tourner en UTC. */
export function tunisNow(d = new Date()) {
  const parts = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Africa/Tunis', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false }).formatToParts(d);
  const get = (t: string) => parts.find(p => p.type === t)?.value || '';
  return { day: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) % 24 };
}
/** Début de la journée de Tunis (UTC+1, sans heure d'été). */
export function tunisDayStart(day: string) { return new Date(`${day}T00:00:00+01:00`); }

/** Chiffres du jour pour le gérant : encaissé, réparations, appareils à rendre, retards, caisse. */
export async function daySummary(shopId: string, day = tunisNow().day) {
  const start = tunisDayStart(day); const end = new Date(start.getTime() + 86400_000); const now = new Date();
  const [payments, received, delivered, ready, overdue, counter, used, session] = await Promise.all([
    prisma.payment.findMany({ where: { shopId, createdAt: { gte: start, lt: end } }, select: { amount: true, kind: true, method: true, counterSaleId: true } }),
    prisma.repair.count({ where: { shopId, createdAt: { gte: start, lt: end } } }),
    prisma.repair.count({ where: { shopId, deliveredAt: { gte: start, lt: end } } }),
    prisma.repair.findMany({ where: { shopId, status: RepairStatus.READY }, select: { code: true, updatedAt: true } }),
    prisma.repair.count({ where: { shopId, promisedAt: { lt: now }, status: { notIn: [RepairStatus.READY, RepairStatus.DELIVERED, RepairStatus.CANCELLED] } } }),
    prisma.counterSale.aggregate({ where: { shopId, createdAt: { gte: start, lt: end } }, _sum: { total: true }, _count: true }),
    prisma.usedDevice.count({ where: { shopId, soldAt: { gte: start, lt: end } } }),
    prisma.cashSession.findFirst({ where: { shopId, status: CashSessionStatus.OPEN }, include: { payments: { select: { amount: true, kind: true, method: true } }, expenses: { select: { amount: true } } } }),
  ]);
  const sign = (p: { kind: PaymentKind; amount: unknown }) => (p.kind === PaymentKind.REFUND ? -1 : 1) * Number(p.amount);
  const net = payments.reduce((a, p) => a + sign(p), 0);
  const byMethod: Record<string, number> = {}; for (const p of payments) byMethod[p.method] = (byMethod[p.method] || 0) + sign(p);
  const expectedCash = session ? Number(session.openingAmount) + session.payments.filter(p => p.method === PaymentMethod.CASH).reduce((a, p) => a + sign(p), 0) - session.expenses.reduce((a, e) => a + Number(e.amount), 0) : null;
  const waitingLong = ready.filter(r => now.getTime() - r.updatedAt.getTime() > 3 * 86400_000).length;
  return { day, net: Math.round(net * 1000) / 1000, count: payments.length, byMethod, received, delivered, readyToCollect: ready.length, readyOver3Days: waitingLong, overdue, counterSales: { count: counter._count, total: Number(counter._sum.total || 0) }, usedSold: used, cashOpen: !!session, expectedCash: expectedCash == null ? null : Math.round(expectedCash * 1000) / 1000 };
}

export function summaryText(shopName: string, s: Awaited<ReturnType<typeof daySummary>>, cur = 'DT') {
  const m = (n: number) => `${n.toFixed(3).replace('.', ',')} ${cur}`;
  return [
    `📊 ${shopName} — résumé du ${s.day.split('-').reverse().join('/')}`,
    `💰 Encaissé : ${m(s.net)} (${s.count} paiement(s))`,
    `🔧 Reçus : ${s.received} · Rendus : ${s.delivered}`,
    `📦 À rendre : ${s.readyToCollect}${s.readyOver3Days ? ` (dont ${s.readyOver3Days} depuis plus de 3 jours)` : ''}`,
    s.overdue ? `⏰ En retard : ${s.overdue}` : '✅ Aucun retard',
    s.counterSales.count ? `🛍️ Ventes comptoir : ${s.counterSales.count} · ${m(s.counterSales.total)}` : '',
    s.usedSold ? `📱 Occasions vendues : ${s.usedSold}` : '',
    s.cashOpen ? `🧾 Caisse ouverte · espèces attendues : ${m(s.expectedCash || 0)}` : '🧾 Caisse fermée',
  ].filter(Boolean).join('\n');
}
