import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad, ok } from '@/lib/http';
import { plain } from '@/lib/serializers';
import { Prisma } from '@prisma/client';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const s = await requireSession();
    const orders = await prisma.supplierOrder.findMany({ where: { shopId: s.shopId, status: { not: 'CANCELLED' } },
      include: { company: { select: { name: true } }, delivery: true, items: { include: { product: { select: { name: true, sku: true } } } },
        settlements: { select: { id: true, reference: true, amount: true, status: true, collector: true, confirmedAt: true, createdAt: true } } },
      orderBy: { createdAt: 'desc' }, take: 200 });
    const sales = orders.length ? await prisma.supplierErpSale.findMany({
      where: { sourceOrderId: { in: orders.map(o => o.id) } },
      select: { sourceOrderId: true, paid: true },
    }) : [];
    const paidByOrder = new Map(sales.filter(s => s.sourceOrderId).map(s => [s.sourceOrderId, s.paid]));
    const result = orders.map(order => {
      const tracked = order.settlements.filter(x => x.status === 'CONFIRMED')
        .reduce((sum, x) => sum.plus(x.amount), new Prisma.Decimal(order.delivery?.cashCollected || 0));
      const paid = Prisma.Decimal.max(tracked, paidByOrder.get(order.id) || 0);
      return { ...order, paid, due: Prisma.Decimal.max(0, order.total.minus(paid)) };
    });
    return ok(plain(result));
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
