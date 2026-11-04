import { NotificationType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSupplierRole } from '@/lib/supplier-auth';
import { bad, ok } from '@/lib/http';
import { notifyShop } from '@/lib/notifications';
import { waLink } from '@/lib/whatsapp-link';
import { churnRisk } from '@/lib/commerce';

const ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'SALES'] as const;
export const dynamic = 'force-dynamic';

/** Ateliers qui commandaient régulièrement et ont décroché. */
export async function GET() {
  try {
    const s = await requireSupplierRole(ROLES);
    const since = new Date(Date.now() - 120 * 86400_000);
    const orders = await prisma.supplierOrder.findMany({ where: { companyId: s.companyId, createdAt: { gte: since }, status: { not: 'CANCELLED' } }, select: { shopId: true, createdAt: true, total: true, shop: { select: { name: true, region: true, phone: true } } } });
    const by = new Map<string, typeof orders>();
    for (const o of orders) { const a = by.get(o.shopId) || []; a.push(o); by.set(o.shopId, a); }
    const rows = [...by.entries()].map(([shopId, list]) => { const r = churnRisk(list.map(o => o.createdAt)); return r && { shopId, name: list[0].shop.name, region: list[0].shop.region, phone: list[0].shop.phone, ...r, total120: Math.round(list.reduce((a, o) => a + Number(o.total), 0) * 1000) / 1000 }; }).filter(Boolean) as any[];
    rows.sort((a, b) => b.total120 - a.total120);
    return ok(rows.map(r => ({ ...r, wa: r.phone ? waLink(r.phone, `Bonjour ${r.name}, ça fait ${r.silentDays} jours qu’on ne vous a pas livré. Besoin de pièces ? Nous avons du nouveau stock et pouvons vous livrer rapidement. ${s.companyName}`) : null })));
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

/** Message personnel à un atelier (au plus un tous les 7 jours par atelier). */
export async function POST(req: Request) {
  try {
    const s = await requireSupplierRole(ROLES);
    const b = await req.json().catch(() => ({}));
    const shopId = String(b.shopId || ''), text = String(b.message || '').trim().slice(0, 300);
    if (text.length < 5) return bad('Écrivez votre message');
    const known = await prisma.supplierOrder.findFirst({ where: { companyId: s.companyId, shopId }, select: { id: true } });
    if (!known) return bad('Atelier inconnu', 404);
    const recent = await prisma.supplierAuditEvent.findFirst({ where: { companyId: s.companyId, action: 'WINBACK_MESSAGE', entityId: shopId, createdAt: { gte: new Date(Date.now() - 7 * 86400_000) } }, select: { id: true } });
    if (recent) return bad('Un message a déjà été envoyé à cet atelier cette semaine', 429);
    await notifyShop(shopId, `Message de ${s.companyName}`, text, '/app/suppliers', NotificationType.INFO, undefined, { experienceKey: 'SHOP_SUPPLIER_PROMO', eventId: 'wb-' + shopId + '-' + Date.now() });
    await prisma.supplierAuditEvent.create({ data: { companyId: s.companyId, accountId: s.id, action: 'WINBACK_MESSAGE', entity: 'SHOP', entityId: shopId, metadata: { length: text.length } } });
    return ok({ ok: true });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
