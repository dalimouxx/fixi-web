import { UserRole } from '@prisma/client';
import { requireVerifiedShop } from '@/lib/shop-verification';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad, ok } from '@/lib/http';
import { plain } from '@/lib/serializers';
import { activePromos, withPromo } from '@/lib/promos';
import { usualParts } from '@/lib/growth';

export const dynamic = 'force-dynamic';

/** « Vos pièces habituelles » : produits commandés au moins 2 fois en 120 jours, quantité habituelle suggérée. */
export async function GET() {
  try {
    const s = await requireSession([UserRole.ADMIN, UserRole.RECEPTION], 'CONNECT');
    await requireVerifiedShop(s.shopId);
    const items = await prisma.supplierOrderItem.findMany({
      where: { order: { shopId: s.shopId, createdAt: { gte: new Date(Date.now() - 120 * 86400_000) }, status: { notIn: ['CANCELLED'] } } },
      select: { productId: true, quantity: true, orderId: true, order: { select: { createdAt: true } } }, take: 3000,
    });
    const picks = usualParts(items.map(i => ({ productId: i.productId, quantity: i.quantity, orderId: i.orderId, at: i.order.createdAt })));
    if (!picks.length) return ok([]);
    const products = await prisma.supplierProduct.findMany({ where: { id: { in: picks.map(p => p.productId) }, active: true, company: { active: true } }, select: { id: true, sku: true, name: true, brand: true, category: true, imageUrl: true, price: true, stock: true, reservedStock: true, minOrderQty: true, company: { select: { id: true, name: true, logoUrl: true, region: true, verified: true } } } });
    const promos = await activePromos(products.map(p => p.id));
    const byId = new Map(products.map(p => [p.id, p]));
    return ok(plain(picks.filter(p => byId.has(p.productId)).map(p => { const { reservedStock, ...row } = byId.get(p.productId)!; return { ...withPromo({ ...row, stock: Math.max(0, row.stock - reservedStock) }, promos), usualQty: p.qty, timesOrdered: p.times, lastAt: p.lastAt }; })));
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
