import { prisma } from '@/lib/prisma';
import { requireSupplierRole } from '@/lib/supplier-auth';
import { bad, ok } from '@/lib/http';
import { customerDues } from '@/lib/supplier-collections';
import { bucketize } from '@/lib/commerce';

export const dynamic = 'force-dynamic';

/** Encaissements à venir (créances, espèces en route, chez les livreurs) face aux achats à payer. */
export async function GET() {
  try {
    const s = await requireSupplierRole(['OWNER', 'ADMIN', 'MANAGER', 'ACCOUNTANT']);
    const [{ rows }, sales, onRoad, shifts, purchases] = await Promise.all([
      customerDues(s.companyId),
      prisma.supplierErpSale.findMany({ where: { companyId: s.companyId, status: { notIn: ['CANCELLED', 'PAID'] } }, select: { total: true, paid: true, dueAt: true, createdAt: true } }),
      prisma.supplierDelivery.findMany({ where: { order: { companyId: s.companyId, status: 'OUT_FOR_DELIVERY' } }, select: { cashDue: true, cashCollected: true } }),
      prisma.supplierDeliveryShift.findMany({ where: { companyId: s.companyId, status: 'OPEN' }, select: { collectedCod: true } }),
      prisma.supplierErpPurchase.findMany({ where: { companyId: s.companyId, status: { notIn: ['CANCELLED', 'PAID'] } }, select: { total: true, paid: true, dueAt: true, createdAt: true } }),
    ]);
    // Une facture sans échéance est attendue 15 jours après sa date.
    const when = (x: { dueAt: Date | null; createdAt: Date }) => x.dueAt || new Date(x.createdAt.getTime() + 15 * 86400_000);
    const incoming = bucketize(sales.map(x => ({ amount: Math.max(0, Number(x.total) - Number(x.paid)), at: when(x) })));
    const outgoing = bucketize(purchases.map(x => ({ amount: Math.max(0, Number(x.total) - Number(x.paid)), at: when(x) })));
    const road = onRoad.reduce((a, d) => a + Math.max(0, Number(d.cashDue) - Number(d.cashCollected)), 0);
    const drivers = shifts.reduce((a, x) => a + Number(x.collectedCod || 0), 0);
    const r3 = (n: number) => Math.round(n * 1000) / 1000;
    return ok({ incoming, outgoing, codOnRoad: r3(road), withDrivers: r3(drivers), customers: rows.length, net7: r3(incoming.overdue + incoming.week + road + drivers - outgoing.overdue - outgoing.week) });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
