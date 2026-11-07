import { requireSupplierRole } from '@/lib/supplier-auth';
import { prisma } from '@/lib/prisma';
import { bad } from '@/lib/http';
import { STOCK_EXPORT_ROLES, buildStockWorkbook, exportFileName } from '@/lib/supplier-stock-export';

/** Tout le stock du fournisseur en un fichier Excel (Stock + À réapprovisionner + Résumé). */
export async function GET() {
  try {
    const s = await requireSupplierRole(STOCK_EXPORT_ROLES);
    const [company, products] = await Promise.all([
      prisma.supplierCompany.findUnique({ where: { id: s.companyId }, select: { name: true, slug: true } }),
      prisma.supplierProduct.findMany({ where: { companyId: s.companyId }, orderBy: [{ active: 'desc' }, { category: 'asc' }, { name: 'asc' }] }),
    ]);
    const at = new Date();
    const { buffer, summary } = await buildStockWorkbook({ name: company?.name || s.companyName }, products as any, at);
    await prisma.supplierAuditEvent.create({ data: { companyId: s.companyId, accountId: s.id, action: 'STOCK_EXPORT', entity: 'SupplierProduct', metadata: { products: summary.products } } }).catch(() => null);
    return new Response(buffer as ArrayBuffer, { headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="${exportFileName(company?.slug || company?.name || '', at)}"`,
      'cache-control': 'no-store',
    } });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
