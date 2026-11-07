import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad, ok } from '@/lib/http';
import { audit } from '@/lib/audit';
import { plain } from '@/lib/serializers';

/** Fournisseur local de l'atelier : corriger ses coordonnées. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await requireSession([UserRole.ADMIN]);
    const { id } = await params;
    if (!await prisma.supplier.findFirst({ where: { id, shopId: s.shopId }, select: { id: true } })) return bad('Fournisseur introuvable', 404);
    const b = await req.json().catch(() => ({}));
    const data: any = {};
    for (const [k, max] of [['name', 120], ['phone', 30], ['email', 120], ['address', 240], ['notes', 500]] as const) if (b[k] !== undefined) data[k] = String(b[k] ?? '').trim().slice(0, max) || null;
    if (data.name === null) return bad('Nom obligatoire');
    const x = await prisma.supplier.update({ where: { id }, data });
    await audit(s.shopId, s.id, 'UPDATE', 'SUPPLIER', id, data);
    return ok(plain(x));
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

/** Supprimer : les pièces et achats gardent leur historique (le fournisseur y apparaît comme « — »). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await requireSession([UserRole.ADMIN]);
    const { id } = await params;
    const x = await prisma.supplier.findFirst({ where: { id, shopId: s.shopId }, include: { _count: { select: { items: true, purchases: true } } } });
    if (!x) return bad('Fournisseur introuvable', 404);
    await prisma.supplier.delete({ where: { id } });
    await audit(s.shopId, s.id, 'DELETE', 'SUPPLIER', id, { name: x.name, items: x._count.items, purchases: x._count.purchases });
    return ok({ ok: true, items: x._count.items, purchases: x._count.purchases });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
