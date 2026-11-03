import { prisma } from '@/lib/prisma';
import { bad, ok } from '@/lib/http';
import { PaymentKind, RepairStatus, SupplierDeliveryStatus, SupplierOrderStatus, UserRole } from '@prisma/client';
import { hashWidgetToken } from '@/lib/widget-token';
import { daysSince, pickupStage, readySince } from '@/lib/pickup-reminders';
import { atelierWidget, driverWidget, supplierWidget } from '@/lib/widget-summary';

export const dynamic = 'force-dynamic';

// Résumé lu par le widget Android : uniquement des compteurs, aucun nom ni téléphone de client.
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const raw = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '') || url.searchParams.get('t') || '';
    const lang = url.searchParams.get('lang') === 'ar' ? 'ar' : 'fr';
    if (raw.length < 20) return bad('Jeton manquant', 401);
    const t = await prisma.widgetToken.findUnique({ where: { tokenHash: hashWidgetToken(raw) } });
    if (!t || t.revokedAt) return bad('Widget déconnecté : reconnectez-le depuis l’application', 401);
    const start = new Date(); start.setHours(0, 0, 0, 0);
    let data;

    if (t.kind === 'SUPPLIER' || t.kind === 'DRIVER') {
      const acc = await prisma.supplierAccount.findFirst({ where: { id: t.userId, companyId: t.companyId || '', isActive: true }, select: { id: true, company: { select: { name: true } } } });
      if (!acc) return bad('Compte désactivé', 401);
      if (t.kind === 'SUPPLIER') {
        const [counts, delivered] = await Promise.all([
          prisma.supplierOrder.groupBy({ by: ['status'], where: { companyId: t.companyId!, status: { in: [SupplierOrderStatus.PENDING, SupplierOrderStatus.CONFIRMED, SupplierOrderStatus.PREPARING, SupplierOrderStatus.READY_FOR_DELIVERY, SupplierOrderStatus.OUT_FOR_DELIVERY] } }, _count: { _all: true } }),
          prisma.supplierOrder.count({ where: { companyId: t.companyId!, status: SupplierOrderStatus.DELIVERED, updatedAt: { gte: start } } }),
        ]);
        const c = Object.fromEntries(counts.map(x => [x.status, x._count._all])) as Record<string, number>;
        data = supplierWidget({ company: acc.company.name, pending: c.PENDING || 0, preparing: (c.CONFIRMED || 0) + (c.PREPARING || 0), ready: c.READY_FOR_DELIVERY || 0, onRoad: c.OUT_FOR_DELIVERY || 0, deliveredToday: delivered }, lang);
      } else {
        const [mine, available, doneToday] = await Promise.all([
          prisma.supplierDelivery.count({ where: { driverAccountId: t.userId, status: { in: [SupplierDeliveryStatus.ASSIGNED, SupplierDeliveryStatus.PICKED_UP, SupplierDeliveryStatus.OUT_FOR_DELIVERY] } } }),
          prisma.supplierDelivery.count({ where: { driverAccountId: null, status: SupplierDeliveryStatus.PENDING, order: { companyId: t.companyId!, status: SupplierOrderStatus.READY_FOR_DELIVERY } } }),
          prisma.supplierDelivery.findMany({ where: { driverAccountId: t.userId, status: SupplierDeliveryStatus.DELIVERED, updatedAt: { gte: start } }, select: { cashCollected: true } }),
        ]);
        data = driverWidget({ company: acc.company.name, mine, available, deliveredToday: doneToday.length, cashToday: doneToday.reduce((a, d) => a + Number(d.cashCollected || 0), 0) }, lang);
      }
    } else {
      if (!t.shopId) return bad('Widget invalide', 401);
      const user = await prisma.user.findFirst({ where: { id: t.userId, shopId: t.shopId, isActive: true }, select: { role: true } });
      if (!user) return bad('Compte désactivé', 401);
      const shop = await prisma.shop.findUnique({ where: { id: t.shopId }, select: { name: true, isActive: true } });
      if (!shop?.isActive) return bad('Atelier inactif', 403);
      const finance = user.role === UserRole.ADMIN || user.role === UserRole.CASHIER;
      const [counts, readyRows, payments] = await Promise.all([
        prisma.repair.groupBy({ by: ['status'], where: { shopId: t.shopId }, _count: { _all: true } }),
        prisma.repair.findMany({ where: { shopId: t.shopId, status: RepairStatus.READY }, select: { updatedAt: true, pickupReminderCount: true, statusEvents: { where: { toStatus: RepairStatus.READY }, select: { toStatus: true, createdAt: true }, orderBy: { createdAt: 'asc' } } }, take: 300 }),
        finance ? prisma.payment.findMany({ where: { shopId: t.shopId, createdAt: { gte: start } }, select: { amount: true, kind: true } }) : Promise.resolve([] as { amount: any; kind: any }[]),
      ]);
      const c = Object.fromEntries(counts.map(x => [x.status, x._count._all])) as Record<string, number>;
      const toRemind = readyRows.filter(r => { const s = readySince(r as any); return s && pickupStage(daysSince(s)) > r.pickupReminderCount; }).length;
      const revenue = payments.reduce((a, p) => a + (p.kind === PaymentKind.PAYMENT ? Number(p.amount) : -Number(p.amount)), 0);
      data = atelierWidget({ shop: shop.name, ready: c.READY || 0, inRepair: (c.IN_REPAIR || 0) + (c.DIAGNOSIS || 0) + (c.RECEIVED || 0), waitingPart: c.WAITING_PART || 0, toRemind, revenueToday: finance ? revenue : null }, lang);
    }
    prisma.widgetToken.update({ where: { id: t.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
    return ok(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
