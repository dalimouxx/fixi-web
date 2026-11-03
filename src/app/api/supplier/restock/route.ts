import { prisma } from '@/lib/prisma';
import { requireSupplierSession } from '@/lib/supplier-auth';
import { bad, ok } from '@/lib/http';
import { SupplierOrderStatus } from '@prisma/client';
import { restockSuggestion } from '@/lib/restock';

const WEEKS = 8;

// Réapprovisionnement conseillé : moyenne commandée par semaine (8 dernières semaines) contre le stock disponible.
export async function GET() {
  try {
    const s = await requireSupplierSession();
    const since = new Date(Date.now() - WEEKS * 7 * 86400000);
    const [items, products] = await Promise.all([
      prisma.supplierOrderItem.findMany({ where: { order: { companyId: s.companyId, createdAt: { gte: since }, status: { notIn: [SupplierOrderStatus.CANCELLED] } } }, select: { productId: true, quantity: true, order: { select: { createdAt: true } } } }),
      prisma.supplierProduct.findMany({ where: { companyId: s.companyId, active: true }, select: { id: true, name: true, sku: true, stock: true, reservedStock: true, minStock: true, imageUrl: true } }),
    ]);
    const weekly = new Map<string, number[]>();
    for (const it of items) {
      const w = Math.min(WEEKS - 1, Math.floor((Date.now() - it.order.createdAt.getTime()) / (7 * 86400000)));
      const arr = weekly.get(it.productId) || Array(WEEKS).fill(0); arr[w] += it.quantity; weekly.set(it.productId, arr);
    }
    const rows = products.map(p => ({ ...p, ...restockSuggestion({ weeklyQty: weekly.get(p.id) || Array(WEEKS).fill(0), stock: p.stock, reserved: p.reservedStock, minStock: p.minStock }) }))
      .filter(x => x.suggested > 0 && x.avgPerWeek > 0)
      .sort((a, b) => Number(b.urgent) - Number(a.urgent) || (a.weeksLeft ?? 99) - (b.weeksLeft ?? 99))
      .slice(0, 20);
    return ok(rows);
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
