import { prisma } from '@/lib/prisma';
import { requireSupplierRole } from '@/lib/supplier-auth';
import { bad, ok } from '@/lib/http';
import { plain } from '@/lib/serializers';
import { Prisma } from '@prisma/client';
import { orderBalance } from '@/lib/supplier-settlement-ledger';
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await requireSupplierRole(['OWNER','ADMIN','MANAGER','ACCOUNTANT']);
    const { id } = await params;
    const receipt = await prisma.$transaction(async tx => {
      const record = await tx.supplierSettlement.findFirst({ where: { id, companyId: s.companyId } });
      if (!record) throw Object.assign(new Error('Encaissement introuvable'), { status: 404 });
      if (record.status !== 'PENDING' || !record.orderId) throw Object.assign(new Error('Encaissement non confirmable'), { status: 409 });
      const { remaining } = await orderBalance(tx, s.companyId, record.orderId);
      if (record.amount.greaterThan(remaining)) throw Object.assign(new Error('Dette deja reglee ou insuffisante'), { status: 409 });
      const saved = await tx.supplierSettlement.update({ where: { id }, data: { status: 'CONFIRMED', confirmedAt: new Date() } });
      await tx.supplierAuditEvent.create({ data: { companyId: s.companyId, accountId: s.id,
        action: 'DRIVER_COLLECTION_CONFIRMED', entity: 'SUPPLIER_ORDER', entityId: record.orderId,
        metadata: { settlementId: id, amount: record.amount.toString(), driverId: record.driverAccountId } } });
      return saved;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return ok(plain(receipt));
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
