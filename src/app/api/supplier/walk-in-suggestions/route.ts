import { prisma } from '@/lib/prisma';
import { requireSupplierRole } from '@/lib/supplier-auth';
import { bad, ok } from '@/lib/http';

/**
 * Suggestions de supplément « passager » : le dernier supplément utilisé pour chaque produit,
 * puis pour chaque catégorie (ex. Écrans → 25 DT). La caisse les propose, le caissier les modifie librement.
 */
export async function GET() {
  try {
    const s = await requireSupplierRole(['OWNER', 'ADMIN', 'MANAGER', 'SALES', 'CASHIER']);
    const recent = await prisma.supplierErpSale.findMany({ where: { companyId: s.companyId, walkInExtra: { gt: 0 } }, orderBy: { createdAt: 'desc' }, take: 300, select: { id: true } });
    const items = recent.length ? await prisma.supplierErpSaleItem.findMany({ where: { saleId: { in: recent.map(r => r.id) }, extra: { gt: 0 }, productId: { not: null } }, select: { saleId: true, productId: true, extra: true } }) : [];
    const order = new Map(recent.map((r, i) => [r.id, i]));
    items.sort((a, b) => (order.get(a.saleId) ?? 0) - (order.get(b.saleId) ?? 0)); // plus récent d'abord
    const products = items.length ? await prisma.supplierProduct.findMany({ where: { companyId: s.companyId, id: { in: [...new Set(items.map(i => i.productId as string))] } }, select: { id: true, category: true } }) : [];
    const cat = new Map(products.map(p => [p.id, p.category || '']));
    const byProduct: Record<string, number> = {}, byCategory: Record<string, number> = {};
    for (const i of items) {
      const pid = i.productId as string, v = Number(i.extra), c = cat.get(pid);
      if (!(pid in byProduct)) byProduct[pid] = v;
      if (c && !(c in byCategory)) byCategory[c] = v;
    }
    return ok({ byProduct, byCategory });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
