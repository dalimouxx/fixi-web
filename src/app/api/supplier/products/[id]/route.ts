import { checkLineId } from '@/lib/supplier-lines';
import { prisma } from '@/lib/prisma';
import { requireSupplierRole } from '@/lib/supplier-auth';
import { bad, ok } from '@/lib/http';
import { plain } from '@/lib/serializers';
import { PRODUCT_EDITORS } from '@/lib/supplier-product-quick';
import { deleteMessage, deleteMode } from '@/lib/stock-delete';

/** Modification rapide (nom, prix, stock, actif) : réservée au gérant et au magasinier (avant : tout compte, livreur compris). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await requireSupplierRole(PRODUCT_EDITORS);
    const { id } = await params;
    const existing = await prisma.supplierProduct.findFirst({ where: { id, companyId: s.companyId } });
    if (!existing) return bad('Produit introuvable', 404);
    const b = await req.json().catch(() => ({}));
    const data: any = {};
    for (const k of ['name', 'brand', 'category', 'description', 'imageUrl']) if (b[k] !== undefined) data[k] = String(b[k] ?? '').trim() || null;
    if (data.name === null) return bad('Nom du produit requis');
    if (b.active !== undefined) data.active = !!b.active;
    if (b.price !== undefined) { data.price = Math.max(0, Number(b.price) || 0); data.retailPrice = data.price; }
    if (b.lineId !== undefined) { const lineId = await checkLineId(s.companyId, b.lineId); if (lineId !== existing.lineId) { data.lineId = lineId; data.lineSince = new Date(); } }
    if (b.minOrderQty !== undefined) data.minOrderQty = Math.max(1, Math.trunc(Number(b.minOrderQty)) || 1);
    const x = await prisma.supplierProduct.update({ where: { id }, data });
    await prisma.supplierAuditEvent.create({ data: { companyId: s.companyId, accountId: s.id, action: 'UPDATE', entity: 'PRODUCT', entityId: id, metadata: data } }).catch(() => null);
    return ok(plain(x));
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

/** Supprimer un produit jamais vendu / commandé / acheté ; sinon l'archiver (caché du catalogue, historique gardé). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await requireSupplierRole(PRODUCT_EDITORS);
    const { id } = await params;
    const p = await prisma.supplierProduct.findFirst({ where: { id, companyId: s.companyId }, select: { id: true, name: true, _count: { select: { orderItems: true, promos: true } } } });
    if (!p) return bad('Produit introuvable', 404);
    const [sales, purchases, moves, returns, docs, counts] = await Promise.all([
      prisma.supplierErpSaleItem.count({ where: { productId: id } }),
      prisma.supplierErpPurchaseItem.count({ where: { productId: id } }),
      prisma.supplierErpStockMovement.count({ where: { productId: id } }),
      prisma.supplierReturnItem.count({ where: { productId: id } }),
      prisma.supplierCommercialDocumentItem.count({ where: { productId: id } }),
      prisma.supplierStockCountItem.count({ where: { productId: id } }),
    ]);
    let mode = deleteMode({ ...p._count, sales, purchases, moves, returns, docs, counts });
    if (mode === 'DELETE') {
      try {
        await prisma.$transaction([
          prisma.supplierPriceTier.deleteMany({ where: { productId: id } }),
          prisma.supplierWarehouseStock.deleteMany({ where: { productId: id } }),
          prisma.stockAlertRequest.deleteMany({ where: { productId: id } }),
          prisma.supplierProduct.delete({ where: { id } }),
        ]);
      } catch { mode = 'ARCHIVE'; }
    }
    if (mode === 'ARCHIVE') await prisma.supplierProduct.update({ where: { id }, data: { active: false } });
    await prisma.supplierAuditEvent.create({ data: { companyId: s.companyId, accountId: s.id, action: mode, entity: 'PRODUCT', entityId: id, metadata: { name: p.name } } }).catch(() => null);
    return ok({ mode, message: deleteMessage(p.name, mode) });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
