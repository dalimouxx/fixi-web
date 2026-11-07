import { NotificationType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSupplierRole } from '@/lib/supplier-auth';
import { bad, ok } from '@/lib/http';
import { plain } from '@/lib/serializers';
import { notifyShop } from '@/lib/notifications';
import { notifySupplier } from '@/lib/supplier-notifications';
import { handoverOk } from '@/lib/return-pickup';

const ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'SALES', 'DELIVERY_MANAGER', 'STOCK'] as const;
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const s = await requireSupplierRole(ROLES);
    const rows = await prisma.supplierReturnPickup.findMany({ where: { companyId: s.companyId, status: { in: ['REQUESTED', 'ACCEPTED', 'COLLECTED'] } }, orderBy: { createdAt: 'desc' }, include: { shop: { select: { name: true, region: true } } } });
    const drivers = await prisma.supplierAccount.findMany({ where: { companyId: s.companyId, role: 'DRIVER', isActive: true }, select: { id: true, fullName: true } });
    return ok(plain({ rows, drivers }));
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

/** accept (avec livreur) · reject · complete (après création de l'avoir). */
export async function PATCH(req: Request) {
  try {
    const s = await requireSupplierRole(ROLES);
    const b = await req.json().catch(() => ({}));
    const p = await prisma.supplierReturnPickup.findFirst({ where: { id: String(b.id || ''), companyId: s.companyId } });
    if (!p) return bad('Reprise introuvable', 404);
    if (b.action === 'accept') {
      const driver = b.driverAccountId ? await prisma.supplierAccount.findFirst({ where: { id: String(b.driverAccountId), companyId: s.companyId, role: 'DRIVER', isActive: true }, select: { id: true, fullName: true } }) : null;
      if (p.status !== 'REQUESTED') return bad('Reprise déjà traitée', 409);
      const dropoff = p.mode === 'SHOP_DROPOFF';
      await prisma.supplierReturnPickup.update({ where: { id: p.id }, data: { status: 'ACCEPTED', driverAccountId: dropoff ? null : driver?.id || null } });
      await notifyShop(p.shopId, 'Reprise acceptée', dropoff ? 'Déposez la pièce chez le fournisseur et donnez-lui votre code de reprise (Commander une pièce → Reprises).' : `Le livreur récupérera la pièce à son prochain passage${driver ? ' (' + driver.fullName + ')' : ''}. Donnez-lui votre code de reprise au moment de la remise.`, '/app/suppliers?tab=orders', NotificationType.INFO).catch(() => {});
      if (!dropoff && !driver) await notifySupplier(s.companyId, 'Pièce à reprendre', 'Une reprise attend le prochain livreur qui passe chez cet atelier.', { href: '/delivery', kind: 'DELIVERY', experienceKey: 'DRIVER_NEW_MISSION', roles: ['DRIVER'], eventId: 'rpd-' + p.id }).catch(() => {});
      if (!dropoff && driver) await notifySupplier(s.companyId, 'Pièce à reprendre', 'Une reprise est ajoutée à votre tournée.', { href: '/delivery', kind: 'DELIVERY', experienceKey: 'DRIVER_NEW_MISSION', accountIds: [driver.id], eventId: 'rpd-' + p.id }).catch(() => {});
      return ok({ ok: true });
    }
    if (b.action === 'receive') {
      // Dépôt par l'atelier lui-même : le fournisseur saisit le code donné par l'atelier.
      if (p.status !== 'ACCEPTED' || p.mode !== 'SHOP_DROPOFF') return bad('Cette reprise passe par le livreur', 409);
      if (!handoverOk(p.handoverCode, b.code)) return bad('Code de reprise incorrect : demandez à l’atelier son code à 4 chiffres.', 403);
      await prisma.supplierReturnPickup.update({ where: { id: p.id }, data: { status: 'COLLECTED', collectedAt: new Date(), collectedById: s.id } });
      await notifyShop(p.shopId, 'Pièce reçue par le fournisseur', 'Votre dépôt est confirmé. L’avoir suivra.', '/app/suppliers?tab=orders', NotificationType.INFO).catch(() => {});
      return ok({ ok: true });
    }
    if (b.action === 'reject') {
      await prisma.supplierReturnPickup.update({ where: { id: p.id }, data: { status: 'REJECTED', note: String(b.note || p.note || '').slice(0, 300) || null } });
      await notifyShop(p.shopId, 'Reprise refusée', String(b.note || 'Le fournisseur a refusé la reprise.'), '/app/suppliers?tab=orders', NotificationType.WARNING).catch(() => {});
      return ok({ ok: true });
    }
    if (b.action === 'complete') {
      const ret = b.returnId ? await prisma.supplierReturn.findFirst({ where: { id: String(b.returnId), companyId: s.companyId }, select: { id: true, reference: true, total: true } }) : null;
      await prisma.supplierReturnPickup.update({ where: { id: p.id }, data: { status: 'COMPLETED', completedAt: new Date(), returnId: ret?.id || null } });
      await notifyShop(p.shopId, 'Avoir créé', ret ? `Avoir ${ret.reference} : ${Number(ret.total).toFixed(3)} DT déduit de votre solde.` : 'La pièce reprise a été traitée par le fournisseur.', '/app/mes-dettes', NotificationType.SUCCESS).catch(() => {});
      return ok({ ok: true });
    }
    return bad('Action inconnue');
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
