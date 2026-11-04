import { NotificationType, UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad, ok } from '@/lib/http';
import { plain } from '@/lib/serializers';
import { notifySupplier } from '@/lib/supplier-notifications';
import { REQUEST_HOURS, requestVisible, validPartRequest } from '@/lib/commerce';

const ROLES = [UserRole.ADMIN, UserRole.RECEPTION];
export const dynamic = 'force-dynamic';

/** Mes demandes de pièces et les réponses des fournisseurs. */
export async function GET() {
  try {
    const s = await requireSession(ROLES, 'CONNECT');
    const rows = await prisma.supplierPartRequest.findMany({ where: { shopId: s.shopId }, orderBy: { createdAt: 'desc' }, take: 30, include: { quotes: { orderBy: { price: 'asc' }, include: { company: { select: { id: true, name: true, region: true, verified: true } } } } } });
    return ok(plain(rows));
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

/** Nouvelle demande : envoyée aux fournisseurs de la région (ou de toute la Tunisie), valable 72 h. */
export async function POST(req: Request) {
  try {
    const s = await requireSession(ROLES, 'CONNECT');
    const v = validPartRequest(await req.json().catch(() => ({})));
    if (!v.ok) return bad(v.error);
    const open = await prisma.supplierPartRequest.count({ where: { shopId: s.shopId, status: 'OPEN', expiresAt: { gt: new Date() } } });
    if (open >= 10) return bad('10 demandes ouvertes au maximum : clôturez-en une avant d’en créer une autre', 429);
    const shop = await prisma.shop.findUnique({ where: { id: s.shopId }, select: { name: true, region: true } });
    const r = await prisma.supplierPartRequest.create({ data: { shopId: s.shopId, ...v.value, region: shop?.region || null, expiresAt: new Date(Date.now() + REQUEST_HOURS * 3600_000) } });
    const companies = await prisma.supplierCompany.findMany({ where: { active: true }, select: { id: true, region: true }, take: 2000 });
    const targets = companies.filter(c => requestVisible(r.scope, r.region, c.region)).slice(0, 60);
    const title = `Demande de pièce · ${shop?.name || 'Atelier'}`;
    const text = `${r.quantity} × ${r.partName}${r.deviceModel ? ' (' + r.deviceModel + ')' : ''}${r.region ? ' · ' + r.region : ''}. Répondez avec votre prix.`;
    await Promise.allSettled(targets.map(c => notifySupplier(c.id, title, text, { href: '/supplier?tab=orders', kind: 'ORDER', experienceKey: 'SUPPLIER_NEW_ORDER', eventId: 'preq-' + r.id, roles: ['OWNER', 'ADMIN', 'MANAGER', 'SALES'], metadata: { requestId: r.id } })));
    return ok({ ...plain(r), sentTo: targets.length }, { status: 201 });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

/** Accepter une réponse (renvoie le produit à mettre au panier) ou clôturer la demande. */
export async function PATCH(req: Request) {
  try {
    const s = await requireSession(ROLES, 'CONNECT');
    const b = await req.json().catch(() => ({}));
    const r = await prisma.supplierPartRequest.findFirst({ where: { id: String(b.id || ''), shopId: s.shopId }, include: { quotes: true } });
    if (!r) return bad('Demande introuvable', 404);
    if (b.action === 'close') { await prisma.supplierPartRequest.update({ where: { id: r.id }, data: { status: 'CLOSED' } }); return ok({ ok: true }); }
    const q = r.quotes.find(x => x.id === String(b.quoteId || ''));
    if (!q) return bad('Réponse introuvable', 404);
    await prisma.$transaction([
      prisma.supplierPartQuote.update({ where: { id: q.id }, data: { status: 'ACCEPTED' } }),
      prisma.supplierPartQuote.updateMany({ where: { requestId: r.id, id: { not: q.id } }, data: { status: 'DECLINED' } }),
      prisma.supplierPartRequest.update({ where: { id: r.id }, data: { status: 'FULFILLED' } }),
    ]);
    await notifySupplier(q.companyId, 'Votre offre est acceptée', `${r.quantity} × ${r.partName} : l’atelier passe commande.`, { href: '/supplier?tab=orders', kind: 'SUCCESS', experienceKey: 'SUPPLIER_UPDATE', eventId: 'pquote-' + q.id }).catch(() => {});
    return ok({ productId: q.productId, quantity: Math.min(q.quantity, r.quantity) });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
