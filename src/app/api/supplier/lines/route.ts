import { prisma } from '@/lib/prisma';
import { requireSupplierRole } from '@/lib/supplier-auth';
import { rolesWith } from '@/lib/supplier-permissions';
import { bad, ok } from '@/lib/http';
import { companyLines } from '@/lib/supplier-lines';

const VIEW = [...new Set([...rolesWith('reports'), ...rolesWith('productEdit')])] as any;
const EDIT = ['OWNER', 'ADMIN', 'MANAGER'] as const;

/** Lignes de produits du fournisseur, avec le nombre de produits de chacune. */
export async function GET() {
  try {
    const s = await requireSupplierRole(VIEW);
    const [lines, counts, own] = await Promise.all([
      companyLines(s.companyId),
      prisma.supplierProduct.groupBy({ by: ['lineId'], where: { companyId: s.companyId, active: true, lineId: { not: null } }, _count: { _all: true } }),
      prisma.supplierProduct.count({ where: { companyId: s.companyId, active: true, lineId: null } }),
    ]);
    const n = new Map(counts.map(c => [c.lineId, c._count._all]));
    return ok({ ownProducts: own, lines: lines.map(l => ({ ...l, products: n.get(l.id) || 0 })) });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

/** Nouvelle ligne : nom, étiquette (MG), dépôt-vente oui/non. */
export async function POST(req: Request) {
  try {
    const s = await requireSupplierRole(EDIT);
    const b = await req.json().catch(() => ({}));
    const name = String(b.name || '').trim().slice(0, 60);
    const tag = String(b.tag || '').trim().toUpperCase().replace(/\s+/g, '').slice(0, 12);
    if (!name || !tag) return bad('Nom et étiquette requis (ex. « Importateur MG », « MG »)');
    const dup = await prisma.supplierProductLine.findFirst({ where: { companyId: s.companyId, tag: { equals: tag, mode: 'insensitive' } } });
    if (dup) return bad(`L’étiquette ${tag} existe déjà`);
    const x = await prisma.supplierProductLine.create({ data: { companyId: s.companyId, name, tag, consignment: b.consignment !== false } });
    await prisma.supplierAuditEvent.create({ data: { companyId: s.companyId, accountId: s.id, action: 'CREATE', entity: 'PRODUCT_LINE', entityId: x.id, metadata: { name, tag, consignment: x.consignment } } }).catch(() => null);
    return ok(x, { status: 201 });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
