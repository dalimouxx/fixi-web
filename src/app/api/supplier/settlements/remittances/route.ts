import { prisma } from '@/lib/prisma';
import { requireSupplierRole } from '@/lib/supplier-auth';
import { bad, ok } from '@/lib/http';
import { plain } from '@/lib/serializers';
import { Prisma } from '@prisma/client';
import { money } from '@/lib/supplier-settlement-ledger';

export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  try {
    const s = await requireSupplierRole(['OWNER','ADMIN','MANAGER','ACCOUNTANT']);
    const b = await req.json();
    if (typeof b.settlementId !== 'string' || !b.settlementId ||
        typeof b.reference !== 'string' || b.reference.length < 8 || b.reference.length > 120) return bad('Reference de remise invalide');
    const amount = money(b.amount);
    const entry = await prisma.$transaction(async tx => {
      const receipt = await tx.supplierSettlement.findFirst({ where: { id: b.settlementId, companyId: s.companyId, collector: 'DRIVER', status: 'CONFIRMED' } });
      if (!receipt) throw Object.assign(new Error('Encaissement livreur confirme introuvable'), { status: 404 });
      const transferred = await tx.supplierSettlementRemittance.aggregate({ where: { settlementId: receipt.id, confirmedAt: { not: null } }, _sum: { amount: true } });
      const balance = receipt.amount.minus(transferred._sum.amount || 0);
      if (amount.greaterThan(balance)) throw Object.assign(new Error('Reversement superieur au montant detenu'), { status: 409 });
      const item = await tx.supplierSettlementRemittance.create({ data: { settlementId: receipt.id, amount, reference: b.reference, confirmedAt: new Date() } });
      await tx.supplierAuditEvent.create({ data: { companyId: s.companyId, accountId: s.id,
        action: 'DRIVER_REMITTANCE_CONFIRMED', entity: 'SUPPLIER_ORDER', entityId: receipt.orderId || receipt.id,
        metadata: { settlementId: receipt.id, remittanceId: item.id, amount: amount.toString(), driverId: receipt.driverAccountId } } });
      return item;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return ok(plain(entry), { status: 201 });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
