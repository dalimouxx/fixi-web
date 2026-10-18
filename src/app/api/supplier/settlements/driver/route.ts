import { prisma } from '@/lib/prisma';
import { requireSupplierRole } from '@/lib/supplier-auth';
import { bad, ok } from '@/lib/http';
import { plain } from '@/lib/serializers';
import { PaymentMethod, Prisma } from '@prisma/client';
import { money, orderBalance } from '@/lib/supplier-settlement-ledger';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const s = await requireSupplierRole(['DRIVER']);
    const rows = await prisma.supplierSettlement.findMany({ where: { companyId: s.companyId, driverAccountId: s.id },
      include: { order: { select: { reference: true } }, remittances: true }, orderBy: { createdAt: 'desc' }, take: 200 });
    return ok(plain(rows));
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
export async function POST(req: Request) {
  try {
    const s = await requireSupplierRole(['DRIVER']);
    const b = await req.json();
    if (typeof b.orderId !== 'string' || typeof b.idempotencyKey !== 'string' || b.idempotencyKey.length < 12 || b.idempotencyKey.length > 128) return bad('Parametres invalides');
    if (b.method !== PaymentMethod.CASH) return bad('Seuls les encaissements en especes sont autorises pour le livreur');
    const amount = money(b.amount);
    const receipt = await prisma.$transaction(async tx => {
      const existing = await tx.supplierSettlement.findUnique({ where: { idempotencyKey: b.idempotencyKey } });
      if (existing) throw Object.assign(new Error('Encaissement deja saisi'), { status: 409 });
      const { order, remaining } = await orderBalance(tx, s.companyId, b.orderId);
      if (order.delivery?.driverAccountId !== s.id) throw Object.assign(new Error('Livraison non attribuee'), { status: 403 });
      if (amount.greaterThan(remaining)) throw Object.assign(new Error('Montant superieur a la dette'), { status: 409 });
      const pending = await tx.supplierSettlement.aggregate({ where: { companyId: s.companyId, orderId: order.id, status: 'PENDING' }, _sum: { amount: true } });
      if (amount.greaterThan(remaining.minus(pending._sum.amount || 0))) throw Object.assign(new Error('Encaissements en attente trop eleves'), { status: 409 });
      const record = await tx.supplierSettlement.create({ data: {
        companyId: s.companyId, shopId: order.shopId, orderId: order.id, driverAccountId: s.id,
        collector: 'DRIVER', status: 'PENDING', method: 'CASH', amount,
        reference: 'LIV-' + crypto.randomUUID(), idempotencyKey: b.idempotencyKey,
        proofUrl: typeof b.proofUrl === 'string' ? b.proofUrl.slice(0, 1000) : null,
        note: typeof b.note === 'string' ? b.note.slice(0, 500) : null
      } });
      await tx.supplierAuditEvent.create({ data: { companyId: s.companyId, accountId: s.id,
        action: 'DRIVER_COLLECTION_RECORDED', entity: 'SUPPLIER_ORDER', entityId: order.id,
        metadata: { settlementId: record.id, amount: amount.toString() } } });
      return record;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return ok(plain(receipt), { status: 201 });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
