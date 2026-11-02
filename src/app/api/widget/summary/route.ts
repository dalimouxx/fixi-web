import { prisma } from '@/lib/prisma';
import { bad, ok } from '@/lib/http';
import { PaymentKind, RepairStatus, UserRole } from '@prisma/client';
import { hashWidgetToken } from '@/lib/widget-token';
import { daysSince, pickupStage, readySince } from '@/lib/pickup-reminders';

export const dynamic = 'force-dynamic';

// Résumé lu par le widget Android : uniquement des compteurs, aucun nom ni téléphone de client.
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const raw = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '') || url.searchParams.get('t') || '';
    if (raw.length < 20) return bad('Jeton manquant', 401);
    const t = await prisma.widgetToken.findUnique({ where: { tokenHash: hashWidgetToken(raw) } });
    if (!t || t.revokedAt) return bad('Widget déconnecté : reconnectez-le depuis l’application', 401);
    const user = await prisma.user.findFirst({ where: { id: t.userId, shopId: t.shopId, isActive: true }, select: { role: true } });
    if (!user) return bad('Compte désactivé', 401);
    const shop = await prisma.shop.findUnique({ where: { id: t.shopId }, select: { name: true, isActive: true } });
    if (!shop?.isActive) return bad('Atelier inactif', 403);
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const finance = user.role === UserRole.ADMIN || user.role === UserRole.CASHIER;
    const [counts, readyRows, payments] = await Promise.all([
      prisma.repair.groupBy({ by: ['status'], where: { shopId: t.shopId }, _count: { _all: true } }),
      prisma.repair.findMany({ where: { shopId: t.shopId, status: RepairStatus.READY }, select: { updatedAt: true, pickupReminderCount: true, statusEvents: { where: { toStatus: RepairStatus.READY }, select: { toStatus: true, createdAt: true }, orderBy: { createdAt: 'asc' } } }, take: 300 }),
      finance ? prisma.payment.findMany({ where: { shopId: t.shopId, createdAt: { gte: start } }, select: { amount: true, kind: true } }) : Promise.resolve([] as { amount: any; kind: any }[]),
    ]);
    const c = Object.fromEntries(counts.map(x => [x.status, x._count._all])) as Record<string, number>;
    const toRemind = readyRows.filter(r => { const s = readySince(r as any); return s && pickupStage(daysSince(s)) > r.pickupReminderCount; }).length;
    const revenue = payments.reduce((a, p) => a + (p.kind === PaymentKind.PAYMENT ? Number(p.amount) : -Number(p.amount)), 0);
    prisma.widgetToken.update({ where: { id: t.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
    return ok({
      shop: shop.name,
      ready: c.READY || 0,
      inRepair: (c.IN_REPAIR || 0) + (c.DIAGNOSIS || 0),
      received: c.RECEIVED || 0,
      waitingPart: c.WAITING_PART || 0,
      toRemind,
      revenueToday: finance ? Math.round(revenue * 1000) / 1000 : null,
      updatedAt: new Date().toISOString(),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
