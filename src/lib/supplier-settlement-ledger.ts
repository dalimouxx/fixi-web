import { Prisma } from '@prisma/client';

/** Accept a natural amount in dinars (50, 50.5, 50,500), preserving millimes. */
export const money = (value: unknown): Prisma.Decimal => {
  if (typeof value !== 'string') {
    throw Object.assign(new Error('Indiquez un montant, par exemple 50 ou 50,500 DT'), { status: 400 });
  }
  const raw = value.trim();
  if (!/^(?:0|[1-9]\\d{0,8})(?:[.,]\\d{1,3})?$/.test(raw)) {
    throw Object.assign(new Error('Montant invalide : écrivez simplement 50, 50.5 ou 50,500'), { status: 400 });
  }
  const amount = new Prisma.Decimal(raw.replace(',', '.'));
  if (!amount.greaterThan(0)) {
    throw Object.assign(new Error('Le montant doit être supérieur à zéro'), { status: 400 });
  }
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
  const sale = await tx.supplierErpSale.findFirst({ where: { companyId, sourceOrderId: orderId }, select: { paid: true } });
  const effectivePaid = sale ? Prisma.Decimal.max(alreadyPaid, sale.paid) : alreadyPaid;
  const remaining = Prisma.Decimal.max(new Prisma.Decimal(0), order.total.minus(effectivePaid));
  return { order, remaining, alreadyPaid: effectivePaid };
}

/** Mirror confirmed marketplace receipts into the existing supplier ERP when a sale exists. */
export async function mirrorSettlementToErp(tx: Prisma.TransactionClient, settlement: {
  companyId: string; orderId: string; amount: Prisma.Decimal; reference: string;
  method: string; accountId: string | null;
}) {
  const sale = await tx.supplierErpSale.findFirst({ where: { companyId: settlement.companyId, sourceOrderId: settlement.orderId } });
  if (!sale) return; // Accounting is generated on delivery; it will backfill this receipt.
  const existing = await tx.supplierErpPayment.findFirst({
    where: { companyId: settlement.companyId, saleId: sale.id, reference: settlement.reference }
  });
  if (existing) return;
  await tx.supplierErpPayment.create({ data: {
    companyId: settlement.companyId, customerId: sale.customerId, saleId: sale.id,
    kind: 'IN', method: settlement.method, amount: settlement.amount,
    reference: settlement.reference, note: 'Reglement Fixi',
    accountId: settlement.accountId
  } });
  const nextPaid = Prisma.Decimal.min(sale.total, sale.paid.plus(settlement.amount));
  await tx.supplierErpSale.update({ where: { id: sale.id }, data: {
    paid: nextPaid, status: nextPaid.greaterThanOrEqualTo(sale.total) ? 'PAID' : 'PARTIALLY_PAID'
  } });
}
