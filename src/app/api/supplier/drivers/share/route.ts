import { prisma } from '@/lib/prisma';
import { requireSupplierRole } from '@/lib/supplier-auth';
import { bad, ok } from '@/lib/http';
import { parseAmount } from '@/lib/product-quick';
import { partnerCouriersAllowed, PARTNER_REFUSED } from '@/lib/partner-couriers';

const ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'DELIVERY_MANAGER'] as const;
export const dynamic = 'force-dynamic';

/** Mes livreurs : lesquels acceptent des courses d'autres fournisseurs, et à quel prix par course. */
export async function GET() {
  try {
    const s = await requireSupplierRole(ROLES);
    const [drivers, allowed] = await Promise.all([prisma.supplierAccount.findMany({ where: { companyId: s.companyId, role: 'DRIVER', isActive: true }, select: { id: true, fullName: true, sharedCourier: true, courierFee: true } }), partnerCouriersAllowed(s.companyId)]);
    return ok({ allowed, drivers: drivers.map(d => ({ ...d, courierFee: Number(d.courierFee) })) });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

export async function PATCH(req: Request) {
  try {
    const s = await requireSupplierRole(ROLES);
    if (!await partnerCouriersAllowed(s.companyId)) return bad(PARTNER_REFUSED, 403);
    const b = await req.json().catch(() => ({}));
    const fee = parseAmount(b.courierFee);
    if (b.sharedCourier && (!Number.isFinite(fee) || fee <= 0 || fee > 200)) return bad('Prix par course : 0,5 à 200 DT');
    const r = await prisma.supplierAccount.updateMany({ where: { id: String(b.id || ''), companyId: s.companyId, role: 'DRIVER' }, data: { sharedCourier: !!b.sharedCourier, ...(Number.isFinite(fee) ? { courierFee: fee } : {}) } });
    if (!r.count) return bad('Livreur introuvable', 404);
    return ok({ ok: true });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
