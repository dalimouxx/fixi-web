import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad, ok } from '@/lib/http';
import { UserRole } from '@prisma/client';
import { plain } from '@/lib/serializers';

/** Détail d'une vente comptoir (par identifiant ou numéro V-000001). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await requireSession([UserRole.ADMIN, UserRole.CASHIER]);
    const { id } = await params;
    const sale = await prisma.counterSale.findFirst({ where: { shopId: s.shopId, OR: [{ id }, { number: id }] }, include: { lines: true, payments: true, client: true, user: { select: { fullName: true } } } });
    if (!sale) return bad('Vente introuvable', 404);
    return ok(plain(sale));
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
