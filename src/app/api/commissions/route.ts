import { RepairStatus, UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad, ok } from '@/lib/http';
import { commissionFor, monthRange } from '@/lib/commissions';

/** Commissions du mois par technicien (gérant). ?month=AAAA-MM */
export async function GET(req: Request) {
  try {
    const s = await requireSession([UserRole.ADMIN]);
    const { month, start, end } = monthRange(new URL(req.url).searchParams.get('month'));
    const [techs, repairs] = await Promise.all([
      prisma.user.findMany({ where: { shopId: s.shopId, role: { in: [UserRole.TECHNICIAN, UserRole.ADMIN] } }, select: { id: true, fullName: true, role: true, isActive: true, commissionRate: true }, orderBy: { fullName: 'asc' } }),
      prisma.repair.findMany({ where: { shopId: s.shopId, status: RepairStatus.DELIVERED, deliveredAt: { gte: start, lt: end }, technicianId: { not: null } }, select: { technicianId: true, finalPrice: true, discountAmount: true, parts: { select: { quantity: true, unitCost: true } } } }),
    ]);
    const rows = techs.map(t => {
      const mine = repairs.filter(r => r.technicianId === t.id).map(r => ({ technicianId: r.technicianId, finalPrice: Number(r.finalPrice || 0), discountAmount: Number(r.discountAmount || 0), partsCost: r.parts.reduce((a, p) => a + p.quantity * Number(p.unitCost), 0) }));
      return { id: t.id, fullName: t.fullName, role: t.role, isActive: t.isActive, ...commissionFor(mine, t.commissionRate == null ? null : Number(t.commissionRate)) };
    }).filter(r => r.isActive || r.count > 0);
    return ok({ month, rows, total: Math.round(rows.reduce((a, r) => a + r.commission, 0) * 1000) / 1000 });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
