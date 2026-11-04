import { NotificationType } from '@prisma/client';
import { prisma } from './prisma';
import { notifyShop } from './notifications';

let lastSweep = 0;

/**
 * Prévient les ateliers qui attendaient une pièce revenue en stock. Pas de branchement sur chaque mouvement de stock :
 * une passe légère (au plus toutes les 30 s) lancée quand on consulte le catalogue ou les produits, et par la tâche planifiée.
 */
export async function sweepBackInStock(force = false) {
  if (!force && Date.now() - lastSweep < 30_000) return 0;
  lastSweep = Date.now();
  const pending = await prisma.stockAlertRequest.findMany({ where: { notifiedAt: null }, select: { id: true, shopId: true, product: { select: { id: true, name: true, stock: true, reservedStock: true, active: true, company: { select: { name: true, active: true } } } } }, take: 500 });
  const ready = pending.filter(a => a.product.active && a.product.company.active && a.product.stock - a.product.reservedStock > 0);
  for (const a of ready) {
    const done = await prisma.stockAlertRequest.updateMany({ where: { id: a.id, notifiedAt: null }, data: { notifiedAt: new Date() } });
    if (!done.count) continue;
    await notifyShop(a.shopId, 'De retour en stock', `${a.product.name} est de nouveau disponible chez ${a.product.company.name}.`, '/app/suppliers?q=' + encodeURIComponent(a.product.name), NotificationType.STOCK, undefined, { experienceKey: 'SHOP_SUPPLIER_PROMO', eventId: 'bis-' + a.id }).catch(() => {});
  }
  return ready.length;
}
