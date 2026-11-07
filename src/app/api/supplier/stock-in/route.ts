import { requireSupplierRole } from '@/lib/supplier-auth';
import { prisma } from '@/lib/prisma';
import { bad, ok } from '@/lib/http';
import { plain } from '@/lib/serializers';
import { cleanStockIn, newAverageCost, r3 } from '@/lib/stock-in';
import { notifySupplierLowStock } from '@/lib/supplier-notifications';

const ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'STOCK'] as const;

/** Coûts d'achat (réservés au gérant / magasinier) pour préremplir l'entrée de stock. */
export async function GET() {
  try {
    const s = await requireSupplierRole(ROLES);
    const rows = await prisma.supplierProduct.findMany({ where: { companyId: s.companyId, active: true }, select: { id: true, purchasePrice: true, averageCost: true }, take: 5000 });
    const recent = await prisma.supplierErpStockMovement.findMany({ where: { companyId: s.companyId, type: { in: ['STOCK_IN', 'PURCHASE'] } }, orderBy: { createdAt: 'desc' }, take: 15, select: { reference: true, quantity: true, createdAt: true, productId: true, note: true } });
    return ok(plain({ costs: Object.fromEntries(rows.map(r => [r.id, Number(r.purchasePrice || r.averageCost || 0)])), recent }));
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

/** Entrée de stock : { items:[{productId, quantity, unitCost?}], source?, reference? } — sans dette fournisseur. */
export async function POST(req: Request) {
  try {
    const s = await requireSupplierRole(ROLES);
    const b = await req.json().catch(() => ({}));
    const lines = cleanStockIn(b.items);
    if (!lines.length) return bad('Scannez au moins un article');
    const products = await prisma.supplierProduct.findMany({ where: { companyId: s.companyId, id: { in: lines.map(l => l.productId) } } });
    if (products.length !== lines.length) return bad('Article introuvable dans votre catalogue', 404);
    const reference = String(b.reference || '').trim().slice(0, 60) || 'ENT-' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + '-' + Date.now().toString(36).slice(-4).toUpperCase();
    const source = String(b.source || '').trim().slice(0, 120) || null;
    let units = 0, value = 0;
    await prisma.$transaction(async tx => {
      for (const l of lines) {
        const p = await tx.supplierProduct.findUniqueOrThrow({ where: { id: l.productId } });
        const cost = l.unitCost ?? Number(p.averageCost || p.purchasePrice || 0);
        const after = p.stock + l.quantity;
        await tx.supplierProduct.update({ where: { id: p.id }, data: { stock: after, averageCost: newAverageCost(p.stock, Number(p.averageCost || p.purchasePrice || 0), l.quantity, cost), ...(l.unitCost !== null ? { purchasePrice: l.unitCost } : {}) } });
        await tx.supplierErpStockMovement.create({ data: { companyId: s.companyId, productId: p.id, type: 'STOCK_IN', quantity: l.quantity, beforeQty: p.stock, afterQty: after, unitCost: cost, reference, note: source ? 'Entrée de stock · ' + source : 'Entrée de stock', accountId: s.id } });
        units += l.quantity; value += l.quantity * cost;
      }
    });
    await prisma.supplierAuditEvent.create({ data: { companyId: s.companyId, accountId: s.id, action: 'STOCK_IN', entity: 'PRODUCT', metadata: { reference, lines: lines.length, units, value: r3(value), source } } }).catch(() => null);
    await Promise.allSettled(lines.map(l => notifySupplierLowStock(s.companyId, l.productId)));
    return ok({ reference, lines: lines.length, units, value: r3(value) }, { status: 201 });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
