import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { getSupplierSession } from '@/lib/supplier-auth';
import { getDeliverySession } from '@/lib/delivery-auth';
import { bad, ok } from '@/lib/http';
import { MAX_WIDGET_TOKENS, hashWidgetToken, newWidgetToken } from '@/lib/widget-token';

// Crée le jeton du widget Android pour l'espace demandé (atelier, fournisseur ou livreur), en lecture seule.
async function owner(space: string) {
  if (space === 'supplier') { const s = await getSupplierSession(); return s ? { kind: 'SUPPLIER', userId: s.id, companyId: s.companyId } : null; }
  if (space === 'delivery') { const s = await getDeliverySession(); return s ? { kind: 'DRIVER', userId: s.id, companyId: s.companyId } : null; }
  const s = await getSession(); return s ? { kind: 'ATELIER', userId: s.id, shopId: s.shopId } : null;
}

export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({}));
    const o = await owner(String(b.space || 'atelier'));
    if (!o) return bad('Connectez-vous d’abord', 401);
    const token = newWidgetToken();
    await prisma.widgetToken.create({ data: { tokenHash: hashWidgetToken(token), ...o } });
    const active = await prisma.widgetToken.findMany({ where: { userId: o.userId, revokedAt: null }, orderBy: { createdAt: 'desc' }, select: { id: true } });
    if (active.length > MAX_WIDGET_TOKENS) await prisma.widgetToken.updateMany({ where: { id: { in: active.slice(MAX_WIDGET_TOKENS).map(x => x.id) } }, data: { revokedAt: new Date() } });
    return ok({ token, kind: o.kind }, { status: 201 });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

export async function DELETE(req: Request) {
  try {
    const space = new URL(req.url).searchParams.get('space') || 'atelier';
    const o = await owner(space);
    if (!o) return bad('Connectez-vous d’abord', 401);
    const r = await prisma.widgetToken.updateMany({ where: { userId: o.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    return ok({ revoked: r.count });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
