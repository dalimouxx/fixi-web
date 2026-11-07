import { requireSupplierRole } from '@/lib/supplier-auth';
import { prisma } from '@/lib/prisma';
import { bad, ok } from '@/lib/http';
import { PRODUCT_EDITORS } from '@/lib/supplier-product-quick';
import { fillMissingBarcodes } from '@/lib/supplier-barcode';

/** Donne un code-barres intelligent (0000A04…) à tous les produits qui n'en ont pas. */
export async function POST() {
  try {
    const s = await requireSupplierRole(PRODUCT_EDITORS);
    const done = await fillMissingBarcodes(s.companyId);
    await prisma.supplierAuditEvent.create({ data: { companyId: s.companyId, accountId: s.id, action: 'BARCODES_GENERATED', entity: 'PRODUCT', metadata: { count: done } } }).catch(() => null);
    return ok({ generated: done });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
