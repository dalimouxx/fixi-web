import { prisma } from '@/lib/prisma';
import { requireSupplierRole, requireSupplierSession } from '@/lib/supplier-auth';
import { bad, ok } from '@/lib/http';

// Catalogue partageable par WhatsApp : public seulement si le fournisseur l'active.
export async function GET(req: Request) {
  try {
    const s = await requireSupplierSession();
    const c = await prisma.supplierCompany.findUnique({ where: { id: s.companyId }, select: { slug: true, name: true, publicCatalog: true } });
    if (!c) return bad('Société introuvable', 404);
    const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    return ok({ public: c.publicCatalog, link: `${base.replace(/\/$/, '')}/catalogue/${c.slug}`, name: c.name });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

export async function PUT(req: Request) {
  try {
    const s = await requireSupplierRole(['OWNER', 'ADMIN', 'MANAGER', 'SALES']);
    const b = await req.json().catch(() => ({}));
    const c = await prisma.supplierCompany.update({ where: { id: s.companyId }, data: { publicCatalog: !!b.public }, select: { slug: true, publicCatalog: true } });
    const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    return ok({ public: c.publicCatalog, link: `${base.replace(/\/$/, '')}/catalogue/${c.slug}` });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
