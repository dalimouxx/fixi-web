import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad, ok } from '@/lib/http';
import { audit } from '@/lib/audit';
import { MAX_WIDGET_TOKENS, hashWidgetToken, newWidgetToken } from '@/lib/widget-token';

// Crée le jeton du widget Android de l'utilisateur connecté (lecture seule du résumé de l'atelier).
export async function POST() {
  try {
    const s = await requireSession(undefined, 'CONNECT');
    const token = newWidgetToken();
    await prisma.widgetToken.create({ data: { tokenHash: hashWidgetToken(token), userId: s.id, shopId: s.shopId } });
    const active = await prisma.widgetToken.findMany({ where: { userId: s.id, revokedAt: null }, orderBy: { createdAt: 'desc' }, select: { id: true } });
    if (active.length > MAX_WIDGET_TOKENS) await prisma.widgetToken.updateMany({ where: { id: { in: active.slice(MAX_WIDGET_TOKENS).map(x => x.id) } }, data: { revokedAt: new Date() } });
    await audit(s.shopId, s.id, 'CREATE', 'WIDGET_TOKEN', undefined, {});
    return ok({ token }, { status: 201 });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

// Déconnecte tous les widgets de l'utilisateur.
export async function DELETE() {
  try {
    const s = await requireSession(undefined, 'CONNECT');
    const r = await prisma.widgetToken.updateMany({ where: { userId: s.id, revokedAt: null }, data: { revokedAt: new Date() } });
    return ok({ revoked: r.count });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
