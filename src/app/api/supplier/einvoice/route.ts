import { prisma } from '@/lib/prisma';
import { requireSupplierSession } from '@/lib/supplier-auth';
import { bad, ok } from '@/lib/http';
import { einvoiceChecks } from '@/lib/growth';

export const dynamic = 'force-dynamic';

/** Préparation à la facture électronique : contrôle des données nécessaires, sans rien transmettre. */
export async function GET() {
  try {
    const s = await requireSupplierSession();
    const since = new Date(Date.now() - 90 * 86400_000);
    const [c, sales, products, productsWithVat] = await Promise.all([
      prisma.supplierCompany.findUnique({ where: { id: s.companyId }, select: { taxId: true, legalName: true, address: true } }),
      prisma.supplierErpSale.findMany({ where: { companyId: s.companyId, createdAt: { gte: since }, customerId: { not: null } }, select: { customerId: true }, distinct: ['customerId'] }),
      prisma.supplierProduct.count({ where: { companyId: s.companyId, active: true } }),
      prisma.supplierProduct.count({ where: { companyId: s.companyId, active: true, taxRate: { gt: 0 } } }),
    ]);
    const ids = sales.map(x => x.customerId!).filter(Boolean);
    const missing = ids.length ? await prisma.supplierErpCustomer.count({ where: { id: { in: ids }, OR: [{ taxId: null }, { taxId: '' }] } }) : 0;
    const salesCount = await prisma.supplierErpSale.count({ where: { companyId: s.companyId, createdAt: { gte: since } } });
    const checks = einvoiceChecks({ taxId: c?.taxId, legalName: c?.legalName, address: c?.address, b2bCustomers: ids.length, b2bMissingTaxId: missing, products, productsWithVat, sales90: salesCount });
    return ok({ checks, ready: checks.filter(x => x.ok).length, total: checks.length, sales90: salesCount });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
