import { prisma } from '@/lib/prisma';
import { requireSupplierRole } from '@/lib/supplier-auth';
import { bad, ok } from '@/lib/http';
import { companyDriverStats } from '@/lib/driver-stats';
import { parseAmount } from '@/lib/product-quick';

export const dynamic = 'force-dynamic';
const ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'DELIVERY_MANAGER', 'ACCOUNTANT'] as const;

export async function GET(req: Request) {
  try { const s = await requireSupplierRole(ROLES); const days = Math.min(90, Math.max(1, Number(new URL(req.url).searchParams.get('days') || 7))); return ok({ days, ...(await companyDriverStats(s.companyId, days)) }); }
  catch (e: any) { return bad(e.message, e.status || 500); }
}

/** Prime par livraison réussie (0 = pas de prime). */
export async function PATCH(req: Request) {
  try {
    const s = await requireSupplierRole(['OWNER', 'ADMIN', 'MANAGER']);
    const v = parseAmount((await req.json().catch(() => ({}))).bonusPerDelivery);
    if (!Number.isFinite(v) || v > 100) return bad('Prime invalide (0 à 100 DT)');
    await prisma.supplierCompany.update({ where: { id: s.companyId }, data: { driverBonusPerDelivery: v } });
    return ok({ bonusPerDelivery: v });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
