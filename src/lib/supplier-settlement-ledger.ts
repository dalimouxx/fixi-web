import { Prisma } from '@prisma/client';

export const money = (value: unknown): Prisma.Decimal => {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d{0,8})\.\d{3}$/.test(value)) {
    throw Object.assign(new Error('Montant invalide (ex: 150.000)'), { status: 400 });
  }
  const amount = new Prisma.Decimal(value);
  if (!amount.greaterThan(0)) throw Object.assign(new Error('Montant nul'), { status: 400 });
  return amount;
};

/** Computes remaining credit for one order, including legacy delivery collections. */
export async function orderBalance(tx: Prisma.TransactionClient, companyId: string, orderId: string) {
  const order = await tx.supplierOrder.findFirst({
    where: { id: orderId, companyId }, include: { delivery: true }
  });
  if (!order) throw Object.assign(new Error('Commande introuvable'), { status: 404 });
  const rows = await tx.supplierSettlement.findMany({
    where: { companyId, orderId, status: 'CONFIRMED' },
    select: { amount: true }
  });
  const alreadyPaid = rows.reduce((sum, item) => sum.plus(item.amount), new Prisma.Decimal(order.delivery?.cashCollected || 0));
  const remaining = Prisma.Decimal.max(new Prisma.Decimal(0), order.total.minus(alreadyPaid));
  return { order, remaining, alreadyPaid };
}
