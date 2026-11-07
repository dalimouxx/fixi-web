import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad, ok } from '@/lib/http';
import { plain } from '@/lib/serializers';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await requireSession([UserRole.ADMIN, UserRole.RECEPTION, UserRole.CASHIER]);
    const { id } = await params;
    const c = await prisma.selfCheckIn.findFirst({ where: { id, shopId: s.shopId } });
    return c ? ok(plain(c)) : bad('Arrivée introuvable', 404);
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

/** { status: 'DISMISSED' } : client parti / doublon. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await requireSession([UserRole.ADMIN, UserRole.RECEPTION, UserRole.CASHIER]);
    const { id } = await params; const b = await req.json().catch(() => ({}));
    if (b.status !== 'DISMISSED') return bad('Statut invalide');
    const r = await prisma.selfCheckIn.updateMany({ where: { id, shopId: s.shopId, status: 'PENDING' }, data: { status: 'DISMISSED' } });
    return ok({ ok: r.count === 1 });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
