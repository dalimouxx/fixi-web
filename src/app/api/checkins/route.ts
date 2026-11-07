import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad, ok } from '@/lib/http';
import { plain } from '@/lib/serializers';

/** Arrivées en attente (enregistrées par les clients via le QR du comptoir). */
export async function GET() {
  try {
    const s = await requireSession([UserRole.ADMIN, UserRole.RECEPTION, UserRole.CASHIER]);
    const rows = await prisma.selfCheckIn.findMany({ where: { shopId: s.shopId, status: 'PENDING', createdAt: { gte: new Date(Date.now() - 2 * 86400_000) } }, orderBy: { createdAt: 'asc' }, take: 30 });
    const shop = await prisma.shop.findUniqueOrThrow({ where: { id: s.shopId }, select: { slug: true } });
    return ok(plain({ rows, slug: shop.slug }));
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
