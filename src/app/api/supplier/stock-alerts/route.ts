import { prisma } from '@/lib/prisma';
import { requireSupplierSession } from '@/lib/supplier-auth';
import { bad, ok } from '@/lib/http';
import { sweepBackInStock } from '@/lib/stock-alerts';

export const dynamic = 'force-dynamic';

/** Nombre d'ateliers qui attendent chaque pièce épuisée : ce qu'il faut racheter en premier. */
export async function GET() {
  try {
    const s = await requireSupplierSession();
    void sweepBackInStock();
    const rows = await prisma.stockAlertRequest.groupBy({ by: ['productId'], where: { companyId: s.companyId, notifiedAt: null }, _count: { _all: true } });
    return ok(Object.fromEntries(rows.map(r => [r.productId, r._count._all])));
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
