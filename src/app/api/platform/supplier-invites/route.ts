import { prisma } from '@/lib/prisma';
import { requirePlatformSession } from '@/lib/platform-auth';
import { bad, ok } from '@/lib/http';

// Fixi Control : demandes d'espace fournisseur venues des invitations des ateliers.
export async function GET() {
  try {
    await requirePlatformSession();
    const rows = await prisma.supplierInvite.findMany({ orderBy: [{ requestedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }], take: 100, include: { inviterShop: { select: { name: true, city: true, region: true, phone: true } } } });
    return ok(rows);
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

export async function PATCH(req: Request) {
  try {
    await requirePlatformSession();
    const b = await req.json().catch(() => ({}));
    const status = String(b.status || '');
    if (!['CONVERTED', 'DECLINED', 'REQUESTED'].includes(status)) return bad('Statut invalide');
    const x = await prisma.supplierInvite.update({ where: { id: String(b.id || '') }, data: { status, convertedAt: status === 'CONVERTED' ? new Date() : null } });
    return ok({ id: x.id, status: x.status });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
