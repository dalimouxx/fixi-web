import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad, ok } from '@/lib/http';
import { plain } from '@/lib/serializers';
import { notifySupplier } from '@/lib/supplier-notifications';

const ROLES = [UserRole.ADMIN, UserRole.RECEPTION];
export const dynamic = 'force-dynamic';
const REASONS = ['DEFECTIVE', 'WRONG_PART', 'EXCHANGE'] as const;

export async function GET() {
  try { const s = await requireSession(ROLES, 'CONNECT'); return ok(plain(await prisma.supplierReturnPickup.findMany({ where: { shopId: s.shopId }, orderBy: { createdAt: 'desc' }, take: 50, include: { company: { select: { name: true } } } }))); }
  catch (e: any) { return bad(e.message, e.status || 500); }
}

/** Demande de reprise d'une ou plusieurs pièces d'une commande livrée (le livreur la récupère au prochain passage). */
export async function POST(req: Request) {
  try {
    const s = await requireSession(ROLES, 'CONNECT');
    const b = await req.json().catch(() => ({}));
    const reason = REASONS.includes(b.reason) ? String(b.reason) : 'DEFECTIVE';
    const o = await prisma.supplierOrder.findFirst({ where: { id: String(b.orderId || ''), shopId: s.shopId, status: 'DELIVERED' }, include: { items: { include: { product: { select: { name: true } } } } } });
    if (!o) return bad('Commande livrée introuvable', 404);
    if (Date.now() - o.updatedAt.getTime() > 60 * 86400_000) return bad('Reprise possible jusqu’à 60 jours après la livraison', 409);
    const sale = await prisma.supplierErpSale.findFirst({ where: { companyId: o.companyId, sourceOrderId: o.id }, select: { id: true } });
    const saleItems = sale ? await prisma.supplierErpSaleItem.findMany({ where: { saleId: sale.id }, select: { id: true, productId: true } }) : [];
    const items = (Array.isArray(b.items) ? b.items : []).map((x: any) => {
      const it = o.items.find(i => i.id === String(x.itemId || '')); const q = Math.trunc(Number(x.quantity || 1));
      if (!it || !(q >= 1) || q > it.quantity) return null;
      return { orderItemId: it.id, productId: it.productId, name: it.product.name, quantity: q, saleItemId: saleItems.find(si => si.productId === it.productId)?.id || null };
    }).filter(Boolean);
    if (!items.length) return bad('Choisissez la pièce et la quantité à reprendre');
    const open = await prisma.supplierReturnPickup.findFirst({ where: { orderId: o.id, status: { in: ['REQUESTED', 'ACCEPTED'] } }, select: { id: true } });
    if (open) return bad('Une reprise est déjà en cours pour cette commande', 409);
    const p = await prisma.supplierReturnPickup.create({ data: { companyId: o.companyId, shopId: s.shopId, orderId: o.id, saleId: sale?.id || null, items: items as any, reason, note: String(b.note || '').slice(0, 300) || null } });
    await notifySupplier(o.companyId, 'Demande de reprise', `${o.reference} : ${items.map((i: any) => i.quantity + ' × ' + i.name).join(', ')}`, { href: '/supplier?tab=returns', kind: 'WARNING', experienceKey: 'SUPPLIER_UPDATE', eventId: 'rp-' + p.id, roles: ['OWNER', 'ADMIN', 'MANAGER', 'SALES', 'DELIVERY_MANAGER'] }).catch(() => {});
    return ok(plain(p), { status: 201 });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
