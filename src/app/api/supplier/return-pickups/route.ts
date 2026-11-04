import { NotificationType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSupplierRole } from '@/lib/supplier-auth';
import { bad, ok } from '@/lib/http';
import { plain } from '@/lib/serializers';
import { notifyShop } from '@/lib/notifications';
import { notifySupplier } from '@/lib/supplier-notifications';

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
      await prisma.supplierReturnPickup.update({ where: { id: p.id }, data: { status: 'ACCEPTED', driverAccountId: driver?.id || null } });
      await notifyShop(p.shopId, 'Reprise acceptée', `Le livreur récupérera la pièce à son prochain passage${driver ? ' (' + driver.fullName + ')' : ''}.`, '/app/suppliers?tab=orders', NotificationType.INFO).catch(() => {});
      if (driver) await notifySupplier(s.companyId, 'Pièce à reprendre', 'Une reprise est ajoutée à votre tournée.', { href: '/delivery', kind: 'DELIVERY', experienceKey: 'DRIVER_NEW_MISSION', accountIds: [driver.id], eventId: 'rpd-' + p.id }).catch(() => {});
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
