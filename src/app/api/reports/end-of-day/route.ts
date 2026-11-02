import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad, ok } from '@/lib/http';
import { PaymentKind, RepairStatus, UserRole } from '@prisma/client';

export const dynamic = 'force-dynamic';

const methodLabels: Record<string, string> = { CASH: 'Espèces', CARD: 'Carte', D17: 'D17', FLOUCI: 'Flouci', BANK_TRANSFER: 'Virement', ONLINE: 'En ligne', CHEQUE: 'Chèque', OTHER: 'Autre' };

// Résumé « fin de journée » de l'atelier : encaissé, dépensé, à récupérer, à rendre.
export async function GET(req: Request) {
  try {
    const s = await requireSession([UserRole.ADMIN, UserRole.CASHIER]);
    const dateParam = new URL(req.url).searchParams.get('date');
    const start = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? new Date(dateParam + 'T00:00:00') : new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    const day = { gte: start, lt: end };

    const [payments, expenses, received, delivered, ready, shop] = await Promise.all([
      prisma.payment.findMany({ where: { shopId: s.shopId, createdAt: day }, select: { amount: true, kind: true, method: true } }),
      prisma.expense.aggregate({ where: { shopId: s.shopId, expenseDate: day }, _sum: { amount: true }, _count: { _all: true } }),
      prisma.repair.count({ where: { shopId: s.shopId, createdAt: day } }),
      prisma.repair.count({ where: { shopId: s.shopId, deliveredAt: day } }),
      prisma.repair.findMany({ where: { shopId: s.shopId, status: RepairStatus.READY }, select: { finalPrice: true, discountAmount: true, payments: { select: { amount: true, kind: true } } } }),
      prisma.shop.findUnique({ where: { id: s.shopId }, select: { name: true, currency: true } }),
    ]);

    const signed = (p: { amount: any; kind: PaymentKind }) => (p.kind === PaymentKind.PAYMENT ? Number(p.amount) : -Number(p.amount));
    const collected = payments.reduce((a, p) => a + signed(p), 0);
    const byMethod: Record<string, number> = {};
    for (const p of payments) { const k = methodLabels[p.method as string] || String(p.method); byMethod[k] = (byMethod[k] || 0) + signed(p); }
    const spent = Number(expenses._sum.amount || 0);
    const readyToCollect = ready.reduce((a, r) => a + Math.max(0, Number(r.finalPrice || 0) - Number(r.discountAmount || 0) - r.payments.reduce((x, p) => x + signed(p), 0)), 0);

    return ok({
      date: start.toISOString().slice(0, 10),
      shopName: shop?.name || s.shopName,
      currency: shop?.currency || 'DT',
      collected, spent, net: collected - spent,
      byMethod,
      paymentsCount: payments.length,
      expensesCount: expenses._count._all,
      received, delivered,
      readyCount: ready.length,
      readyToCollect,
    });
  } catch (e: any) {
    return bad(e.message, e.status || 500);
  }
}
