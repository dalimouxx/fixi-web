import { cleanCommissions } from '@/lib/supplier-lines';
import { prisma } from '@/lib/prisma';
import { requireSupplierRole } from '@/lib/supplier-auth';
import { bad, ok } from '@/lib/http';

/** Modifier une ligne (nom, étiquette, dépôt-vente, active). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await requireSupplierRole(['OWNER', 'ADMIN', 'MANAGER']);
    const { id } = await params;
    const line = await prisma.supplierProductLine.findFirst({ where: { id, companyId: s.companyId } });
    if (!line) return bad('Ligne introuvable', 404);
    const b = await req.json().catch(() => ({}));
    const data: any = {};
    if (b.name !== undefined) { data.name = String(b.name).trim().slice(0, 60); if (!data.name) return bad('Nom requis'); }
    if (b.tag !== undefined) {
      data.tag = String(b.tag).trim().toUpperCase().replace(/\s+/g, '').slice(0, 12);
      if (!data.tag) return bad('Étiquette requise');
      const dup = await prisma.supplierProductLine.findFirst({ where: { companyId: s.companyId, id: { not: id }, tag: { equals: data.tag, mode: 'insensitive' } } });
      if (dup) return bad(`L’étiquette ${data.tag} existe déjà`);
    }
    if (b.consignment !== undefined) data.consignment = !!b.consignment;
    if (b.commissions !== undefined) data.commissions = cleanCommissions(b.commissions);
    if (b.active !== undefined) data.active = !!b.active;
    const x = await prisma.supplierProductLine.update({ where: { id }, data });
    await prisma.supplierAuditEvent.create({ data: { companyId: s.companyId, accountId: s.id, action: 'UPDATE', entity: 'PRODUCT_LINE', entityId: id, metadata: data } }).catch(() => null);
    return ok(x);
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

/**
 * Supprimer une ligne créée par erreur (ex. « DS ») : ses produits reviennent dans les produits du fournisseur.
 * Si des paiements ont déjà été versés au propriétaire de la ligne, elle est seulement désactivée (historique gardé).
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await requireSupplierRole(['OWNER', 'ADMIN', 'MANAGER']);
    const { id } = await params;
    const line = await prisma.supplierProductLine.findFirst({ where: { id, companyId: s.companyId } });
    if (!line) return bad('Ligne introuvable', 404);
    const moved = await prisma.supplierProduct.updateMany({ where: { companyId: s.companyId, lineId: id }, data: { lineId: null, lineSince: new Date() } });
    await prisma.supplierWarehouse.updateMany({ where: { companyId: s.companyId, lineId: id }, data: { lineId: null } });
    const payments = await prisma.supplierErpPayment.count({ where: { companyId: s.companyId, lineId: id } });
    if (payments) await prisma.supplierProductLine.update({ where: { id }, data: { active: false } });
    else await prisma.supplierProductLine.delete({ where: { id } });
    await prisma.supplierAuditEvent.create({ data: { companyId: s.companyId, accountId: s.id, action: payments ? 'ARCHIVE' : 'DELETE', entity: 'PRODUCT_LINE', entityId: id, metadata: { tag: line.tag, productsMoved: moved.count } } }).catch(() => null);
    return ok({ deleted: !payments, archived: !!payments, productsMoved: moved.count, tag: line.tag });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
