import { prisma } from '@/lib/prisma';
import { requireDeliverySession } from '@/lib/delivery-auth';
import { bad, ok } from '@/lib/http';
import { plain } from '@/lib/serializers';
import { notifySupplier } from '@/lib/supplier-notifications';

export const dynamic = 'force-dynamic';

/** Reprises à faire par ce livreur (ou non attribuées dans sa société). */
export async function GET() {
  try {
    const s = await requireDeliverySession();
    const rows = await prisma.supplierReturnPickup.findMany({ where: { companyId: s.companyId, status: 'ACCEPTED', OR: [{ driverAccountId: s.id }, { driverAccountId: null }] }, include: { shop: { select: { name: true, address: true, phone: true, region: true } } }, orderBy: { createdAt: 'asc' } });
    return ok(plain(rows));
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

/** Reprise faite : photo de la pièce récupérée, puis retour au dépôt. */
export async function PATCH(req: Request) {
  try {
    const s = await requireDeliverySession();
    const b = await req.json().catch(() => ({}));
    const done = await prisma.supplierReturnPickup.updateMany({ where: { id: String(b.id || ''), companyId: s.companyId, status: 'ACCEPTED', OR: [{ driverAccountId: s.id }, { driverAccountId: null }] }, data: { status: 'COLLECTED', driverAccountId: s.id, collectedAt: new Date(), proofUrl: typeof b.proofUrl === 'string' && b.proofUrl.startsWith('data:image/') && b.proofUrl.length < 1_600_000 ? b.proofUrl : null } });
    if (!done.count) return bad('Reprise introuvable ou déjà faite', 404);
    await notifySupplier(s.companyId, 'Pièce reprise', `${s.fullName} a récupéré une pièce à retourner : créez l’avoir à la réception.`, { href: '/supplier?tab=returns', kind: 'DELIVERY', experienceKey: 'SUPPLIER_UPDATE', roles: ['OWNER', 'ADMIN', 'MANAGER', 'STOCK', 'DELIVERY_MANAGER'] }).catch(() => {});
    return ok({ ok: true });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
