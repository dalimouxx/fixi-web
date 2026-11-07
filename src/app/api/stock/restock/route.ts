import { StockMovementType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad, ok } from '@/lib/http';
import { restockPlan, restockSentence } from '@/lib/shop-restock';

/** Articles à recommander bientôt, avec la phrase prête à lire. */
export async function GET() {
  try {
    const s = await requireSession();
    const since = new Date(Date.now() - 28 * 86400_000);
    const [items, moves] = await Promise.all([
      prisma.inventoryItem.findMany({ where: { shopId: s.shopId, active: true }, select: { id: true, name: true, sku: true, quantity: true, minQuantity: true } }),
      prisma.stockMovement.findMany({ where: { shopId: s.shopId, createdAt: { gte: since }, type: { in: [StockMovementType.SALE, StockMovementType.CONSUMPTION] } }, select: { inventoryItemId: true, quantityChange: true } }),
    ]);
    return ok({ rows: restockPlan(items, moves).slice(0, 20).map(x => ({ ...x, sentence: restockSentence(x) })) });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
