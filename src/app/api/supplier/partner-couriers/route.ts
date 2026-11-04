import { NotificationType, SupplierDeliveryStatus, SupplierOrderStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSupplierRole } from '@/lib/supplier-auth';
import { bad, ok } from '@/lib/http';
import { plain } from '@/lib/serializers';
import { notifySupplier } from '@/lib/supplier-notifications';
import { notifyShop } from '@/lib/notifications';
import { requestVisible } from '@/lib/commerce';
import { partnerCouriersAllowed, PARTNER_REFUSED } from '@/lib/partner-couriers';

const ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'DELIVERY_MANAGER'] as const;
export const dynamic = 'force-dynamic';

/** Livreurs d'autres fournisseurs disponibles dans ma région (prix par course affiché). */
export async function GET() {
  try {
    const s = await requireSupplierRole(ROLES);
    const allowed = await partnerCouriersAllowed(s.companyId);
    if (!allowed) return ok({ allowed, couriers: [] });
    const me = await prisma.supplierCompany.findUnique({ where: { id: s.companyId }, select: { region: true } });
    const rows = await prisma.supplierAccount.findMany({ where: { role: 'DRIVER', isActive: true, sharedCourier: true, driverAvailable: true, companyId: { not: s.companyId }, company: { active: true } }, select: { id: true, fullName: true, courierFee: true, company: { select: { name: true, region: true } } }, take: 200 });
    return ok({ allowed, couriers: rows.filter(r => requestVisible('REGION', r.company.region, me?.region)).map(r => ({ id: r.id, name: r.fullName, fee: Number(r.courierFee), company: r.company.name, region: r.company.region })) });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

/**
 * Confier une commande prête à un livreur partenaire. Pas d'encaissement par le livreur (paiement hors livraison) :
 * l'argent de chaque fournisseur reste séparé. La course est réglée directement au livreur au prix affiché.
 */
export async function POST(req: Request) {
  try {
    const s = await requireSupplierRole(ROLES);
    if (!await partnerCouriersAllowed(s.companyId)) return bad(PARTNER_REFUSED, 403);
    const b = await req.json().catch(() => ({}));
    const [order, driver] = await Promise.all([
      prisma.supplierOrder.findFirst({ where: { id: String(b.orderId || ''), companyId: s.companyId }, include: { delivery: true, shop: { select: { name: true } } } }),
      prisma.supplierAccount.findFirst({ where: { id: String(b.driverId || ''), role: 'DRIVER', isActive: true, sharedCourier: true, driverAvailable: true, companyId: { not: s.companyId } }, select: { id: true, fullName: true, phone: true, companyId: true, courierFee: true } }),
    ]);
    if (!order) return bad('Commande introuvable', 404);
    if (order.status !== SupplierOrderStatus.READY_FOR_DELIVERY) return bad('La commande doit être prête à livrer', 409);
    if (!driver) return bad('Livreur partenaire indisponible', 409);
    if (order.delivery?.driverAccountId) return bad('Cette commande a déjà un livreur', 409);
    const data = { driverAccountId: driver.id, driverName: driver.fullName, driverPhone: driver.phone || null, partnerCompanyId: driver.companyId, courierFee: driver.courierFee, cashDue: 0, assignedAt: new Date(), status: SupplierDeliveryStatus.ASSIGNED, trackingNote: 'Livreur partenaire · paiement hors livraison' };
    const delivery = order.delivery
      ? (await prisma.supplierDelivery.updateMany({ where: { orderId: order.id, driverAccountId: null }, data }), await prisma.supplierDelivery.findUniqueOrThrow({ where: { orderId: order.id } }))
      : await prisma.supplierDelivery.create({ data: { orderId: order.id, ...data } });
    if (delivery.driverAccountId !== driver.id) return bad('Commande affectée entre-temps', 409);
    await prisma.supplierDeliveryEvent.create({ data: { companyId: s.companyId, orderId: order.id, accountId: s.id, type: 'PARTNER_ASSIGNED', note: `Confiée à ${driver.fullName} (livreur partenaire) · ${Number(driver.courierFee).toFixed(3)} DT la course` } });
    await Promise.allSettled([
      notifySupplier(driver.companyId, '🚚 Course partenaire', `${s.companyName} vous confie ${order.reference} · ${order.shop.name} (${Number(driver.courierFee).toFixed(3)} DT).`, { href: '/delivery', kind: 'DELIVERY', priority: 'HIGH', experienceKey: 'DRIVER_NEW_MISSION', eventId: order.id + '-partner', accountIds: [driver.id] }),
      notifyShop(order.shopId, 'Livreur affecté', `${driver.fullName} livrera votre commande ${order.reference}.`, '/app/suppliers?tab=orders', NotificationType.INFO, undefined, { experienceKey: 'SHOP_ORDER_PROGRESS', eventId: order.id + '-ASSIGNED' }),
    ]);
    return ok(plain(delivery));
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
