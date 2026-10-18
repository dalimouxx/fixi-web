import { prisma } from '@/lib/prisma';
import { requireSupplierRole } from '@/lib/supplier-auth';
import { bad, ok } from '@/lib/http';
import { plain } from '@/lib/serializers';
import { Prisma, PaymentMethod } from '@prisma/client';
import { money, orderBalance } from '@/lib/supplier-settlement-ledger';

export const dynamic = 'force-dynamic';
const roles = ['OWNER','ADMIN','MANAGER','ACCOUNTANT','CASHIER'] as const;

export async function GET(req: Request) {
  try {
    const s = await requireSupplierRole(roles);
    const shopId = new URL(req.url).searchParams.get('shopId');
    const rows = await prisma.supplierSettlement.findMany({
      where: { companyId: s.companyId, ...(shopId ? { shopId } : {}) },
      include: { remittances: true, order: { select: { reference: true, total: true } } },
      orderBy: { createdAt: 'desc' }, take: 300,
    });
    return ok(plain(rows));
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

export async function POST(req: Request) {
  try {
    const s = await requireSupplierRole(roles);
    const b = await req.json();
    if (typeof b.orderId !== 'string' || !b.orderId ||
        typeof b.idempotencyKey !== 'string' || b.idempotencyKey.length < 12 || b.idempotencyKey.length > 128) {
      return bad('Commande ou identifiant de paiement invalide');
    }
    if (!Object.values(PaymentMethod).includes(b.method)) return bad('Mode de paiement invalide');
    const amount = money(b.amount);
    const result = await prisma.$transaction(async tx => {
      const existing = await tx.supplierSettlement.findUnique({ where: { idempotencyKey: b.idempotencyKey } });
      if (existing) throw Object.assign(new Error('Paiement deja enregistre'), { status: 409 });
      const { order, remaining } = await orderBalance(tx, s.companyId, b.orderId);
      if (amount.greaterThan(remaining)) throw Object.assign(new Error('Montant superieur au reste a payer'), { status: 409 });
      const receipt = await tx.supplierSettlement.create({ data: {
        companyId: s.companyId, shopId: order.shopId, orderId: order.id,
        collector: 'SUPPLIER', status: 'CONFIRMED', amount, method: b.method,
        reference: 'REG-' + crypto.randomUUID(), idempotencyKey: b.idempotencyKey,
        confirmedAt: new Date(), note: typeof b.note === 'string' ? b.note.slice(0, 500) : null,
      } });
      await tx.supplierAuditEvent.create({ data: { companyId: s.companyId, accountId: s.id,
        action: 'SETTLEMENT_CONFIRMED', entity: 'SUPPLIER_ORDER', entityId: order.id,
        metadata: { settlementId: receipt.id, amount: amount.toString(), collector: 'SUPPLIER' } } });
      return receipt;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return ok(plain(result), { status: 201 });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
