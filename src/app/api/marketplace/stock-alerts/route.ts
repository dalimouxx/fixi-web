import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad, ok } from '@/lib/http';

const ROLES = [UserRole.ADMIN, UserRole.RECEPTION];
export const dynamic = 'force-dynamic';

/** Pièces épuisées que l'atelier attend. */
export async function GET() {
  try { const s = await requireSession(ROLES, 'CONNECT'); const rows = await prisma.stockAlertRequest.findMany({ where: { shopId: s.shopId, notifiedAt: null }, select: { productId: true } }); return ok(rows.map(r => r.productId)); }
  catch (e: any) { return bad(e.message, e.status || 500); }
}

/** « Me prévenir » sur une pièce épuisée. */
export async function POST(req: Request) {
  try {
    const s = await requireSession(ROLES, 'CONNECT');
    const b = await req.json().catch(() => ({}));
    const p = await prisma.supplierProduct.findFirst({ where: { id: String(b.productId || ''), active: true, company: { active: true } }, select: { id: true, companyId: true } });
    if (!p) return bad('Pièce introuvable', 404);
    await prisma.stockAlertRequest.upsert({ where: { shopId_productId: { shopId: s.shopId, productId: p.id } }, update: { notifiedAt: null, createdAt: new Date() }, create: { shopId: s.shopId, productId: p.id, companyId: p.companyId } });
    return ok({ ok: true }, { status: 201 });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

export async function DELETE(req: Request) {
  try {
    const s = await requireSession(ROLES, 'CONNECT');
    const id = new URL(req.url).searchParams.get('productId') || '';
    await prisma.stockAlertRequest.deleteMany({ where: { shopId: s.shopId, productId: id } });
    return ok({ ok: true });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
