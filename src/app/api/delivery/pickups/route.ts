import { prisma } from '@/lib/prisma';
import { requireDeliverySession } from '@/lib/delivery-auth';
import { bad, ok } from '@/lib/http';
import { plain } from '@/lib/serializers';
import { notifySupplier } from '@/lib/supplier-notifications';
import { notifyShop } from '@/lib/notifications';
import { handoverOk } from '@/lib/return-pickup';

export const dynamic = 'force-dynamic';

/** Reprises à faire par ce livreur (ou non attribuées dans sa société). */
export async function GET() {
  try {
    const s = await requireDeliverySession();
    const rows = await prisma.supplierReturnPickup.findMany({ where: { companyId: s.companyId, status: 'ACCEPTED', mode: 'DRIVER', OR: [{ driverAccountId: s.id }, { driverAccountId: null }] }, select: { id: true, shopId: true, items: true, reason: true, note: true, createdAt: true, driverAccountId: true, handoverCode: true, shop: { select: { name: true, address: true, phone: true, region: true } } }, orderBy: { createdAt: 'asc' } });
    // Le code reste chez l'atelier : le livreur sait seulement qu'il doit le demander.
    return ok(plain(rows.map(({ handoverCode, ...r }) => ({ ...r, needsCode: !!handoverCode }))));
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

/** Reprise faite : photo de la pièce récupérée, puis retour au dépôt. */
export async function PATCH(req: Request) {
  try {
    const s = await requireDeliverySession();
    const b = await req.json().catch(() => ({}));
    const p = await prisma.supplierReturnPickup.findFirst({ where: { id: String(b.id || ''), companyId: s.companyId, status: 'ACCEPTED', mode: 'DRIVER', OR: [{ driverAccountId: s.id }, { driverAccountId: null }] }, select: { id: true, shopId: true, handoverCode: true, items: true } });
    if (!p) return bad('Reprise introuvable ou déjà faite', 404);
    if (!handoverOk(p.handoverCode, b.code)) return bad('Code de reprise incorrect : demandez à l’atelier le code à 4 chiffres affiché dans Commander une pièce → Reprises.', 403);
    const done = await prisma.supplierReturnPickup.updateMany({ where: { id: p.id, status: 'ACCEPTED' }, data: { status: 'COLLECTED', driverAccountId: s.id, collectedById: s.id, collectedAt: new Date(), proofUrl: typeof b.proofUrl === 'string' && b.proofUrl.startsWith('data:image/') && b.proofUrl.length < 1_600_000 ? b.proofUrl : null } });
    if (!done.count) return bad('Reprise déjà faite', 409);
    await notifyShop(p.shopId, 'Pièce reprise par le livreur', `${s.fullName} a récupéré : ${(p.items as any[]).map(i => i.quantity + ' × ' + i.name).join(', ')}. L’avoir suivra à la réception chez le fournisseur.`, '/app/suppliers?tab=orders').catch(() => {});
    await notifySupplier(s.companyId, 'Pièce reprise', `${s.fullName} a récupéré une pièce à retourner : créez l’avoir à la réception.`, { href: '/supplier?tab=returns', kind: 'DELIVERY', experienceKey: 'SUPPLIER_UPDATE', roles: ['OWNER', 'ADMIN', 'MANAGER', 'STOCK', 'DELIVERY_MANAGER'] }).catch(() => {});
    return ok({ ok: true });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
