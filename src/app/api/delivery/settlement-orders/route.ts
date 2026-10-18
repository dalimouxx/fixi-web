import { prisma } from '@/lib/prisma';
import { requireDeliverySession } from '@/lib/delivery-auth';
import { bad, ok } from '@/lib/http';
import { Prisma, SupplierOrderStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';
const zero = new Prisma.Decimal(0);
const toMoney = (value: Prisma.Decimal) => Number(value.toFixed(3));

/** The available balance uses the same ERP, settlement and return rules as orderBalance(). */
export async function GET() {
  try {
    const s = await requireDeliverySession();
    const orders = await prisma.supplierOrder.findMany({
      where: {
        companyId: s.companyId,
        delivery: { is: { driverAccountId: s.id } },
        status: { notIn: [
          SupplierOrderStatus.CANCELLED,
          SupplierOrderStatus.RETURNING,
          SupplierOrderStatus.RETURNED,
        ] },
      },
      select: {
        id: true, reference: true, status: true, total: true, updatedAt: true,
        shop: { select: { name: true } },
        delivery: { select: { cashCollected: true } },
      },
      orderBy: { updatedAt: 'desc' }, take: 100,
    });
    if (!orders.length) return ok([]);

    const ids = orders.map(order => order.id);
    const [sales, receipts] = await Promise.all([
      prisma.supplierErpSale.findMany({
        where: { companyId: s.companyId, sourceOrderId: { in: ids },
          status: { not: 'CANCELLED' } },
        select: { id: true, sourceOrderId: true, reference: true, paid: true, total: true },
      }),
      prisma.supplierSettlement.findMany({
        where: { companyId: s.companyId, orderId: { in: ids }, status: { in: ['CONFIRMED', 'PENDING'] } },
        select: { orderId: true, amount: true, status: true },
      }),
    ]);
    const returns = sales.length ? await prisma.supplierReturn.findMany({
      where: { companyId: s.companyId, sourceSaleId: { in: sales.map(sale => sale.id) },
        type: 'SALE_RETURN', status: 'COMPLETED' },
      select: { sourceSaleId: true, total: true, refund: true },
    }) : [];
    const saleByOrder = new Map(sales.filter(sale => sale.sourceOrderId).map(sale => [sale.sourceOrderId!, sale]));
    const result = orders.map(order => {
      const sale = saleByOrder.get(order.id);
      const confirmed = receipts.filter(r => r.orderId === order.id && r.status === 'CONFIRMED')
        .reduce((sum, r) => sum.plus(r.amount), zero);
      const pending = receipts.filter(r => r.orderId === order.id && r.status === 'PENDING')
        .reduce((sum, r) => sum.plus(r.amount), zero);
      const legacyPaid = order.delivery?.cashCollected || zero;
      const grossPaid = sale
        ? Prisma.Decimal.max(sale.paid, legacyPaid.plus(confirmed))
        : legacyPaid.plus(confirmed);
      const credits = returns.filter(r => sale && r.sourceSaleId === sale.id);
      const creditTotal = credits.reduce((sum,r) => sum.plus(r.total),zero);
      const refunded = credits.reduce((sum,r) => sum.plus(r.refund),zero);
      const originalTotal = sale?.total || order.total;
      const total = Prisma.Decimal.max(zero, originalTotal.minus(creditTotal));
      const paid = Prisma.Decimal.max(zero, grossPaid.minus(refunded));
      const due = Prisma.Decimal.max(zero, total.minus(paid));
      const availableToCollect = Prisma.Decimal.max(zero, due.minus(pending));
      return {
        id: order.id,
        reference: order.reference,
        invoiceReference: sale?.reference || null,
        hasInvoice: !!sale,
        status: order.status,
        shop: order.shop,
        originalTotal: toMoney(originalTotal),
        creditTotal: toMoney(creditTotal),
        total: toMoney(total),
        paid: toMoney(paid),
        due: toMoney(due),
        pending: toMoney(pending),
        availableToCollect: toMoney(availableToCollect),
      };
    });
    return ok(result);
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
