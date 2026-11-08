import { prisma } from '@/lib/prisma';
import { requireSupplierRole } from '@/lib/supplier-auth';
import { PRODUCT_EDITORS } from '@/lib/supplier-product-quick';
import { bad, ok } from '@/lib/http';
import { checkLineId } from '@/lib/supplier-lines';

/** Ranger des produits dans une ligne (ou les remettre dans « mes produits » avec line = own). */
export async function POST(req: Request) {
  try {
    const s = await requireSupplierRole(PRODUCT_EDITORS);
    const b = await req.json().catch(() => ({}));
    const ids = (Array.isArray(b.productIds) ? b.productIds : []).map((x: unknown) => String(x)).filter(Boolean).slice(0, 2000);
    if (!ids.length) return bad('Aucun produit choisi');
    const lineId = await checkLineId(s.companyId, b.lineId);
    // La date d'entrée ne change que pour les produits qui changent vraiment de ligne.
    // (Attention aux produits sans ligne : « différent de MG » doit aussi inclure « aucune ligne ».)
    const changing = lineId ? { OR: [{ lineId: null }, { lineId: { not: lineId } }] } : { lineId: { not: null } };
    const r = await prisma.supplierProduct.updateMany({ where: { companyId: s.companyId, id: { in: ids }, ...changing }, data: { lineId, lineSince: new Date() } });
    await prisma.supplierAuditEvent.create({ data: { companyId: s.companyId, accountId: s.id, action: 'ASSIGN_LINE', entity: 'PRODUCT', metadata: { lineId, count: r.count } } }).catch(() => null);
    return ok({ updated: r.count });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
