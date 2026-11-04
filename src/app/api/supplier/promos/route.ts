import { NotificationType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSupplierRole, requireSupplierSession } from '@/lib/supplier-auth';
import { bad, ok } from '@/lib/http';
import { plain } from '@/lib/serializers';
import { notifyShop } from '@/lib/notifications';
import { parseAmount } from '@/lib/product-quick';

const EDITORS = ['OWNER', 'ADMIN', 'MANAGER', 'SALES'] as const;
const MAX_NOTIFY_PER_DAY = 5;

export async function GET() {
  try {
    const s = await requireSupplierSession();
    const rows = await prisma.supplierPromo.findMany({ where: { companyId: s.companyId }, include: { product: { select: { id: true, name: true, price: true, retailPrice: true, imageUrl: true } } }, orderBy: { createdAt: 'desc' }, take: 50 });
    return ok(plain(rows));
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

/** Nouvelle promotion : prix réellement appliqué aux commandes des ateliers jusqu'à la date de fin. */
export async function POST(req: Request) {
  try {
    const s = await requireSupplierRole(EDITORS);
    const b = await req.json().catch(() => ({}));
    const product = await prisma.supplierProduct.findFirst({ where: { id: String(b.productId || ''), companyId: s.companyId, active: true }, select: { id: true, name: true, price: true } });
    if (!product) return bad('Produit introuvable', 404);
    const promoPrice = parseAmount(b.promoPrice), regular = Number(product.price);
    if (!Number.isFinite(promoPrice) || promoPrice <= 0) return bad('Prix promo invalide');
    if (promoPrice >= regular) return bad(`Le prix promo doit être inférieur au prix actuel (${regular.toFixed(3)} DT)`);
    const days = Math.trunc(Number(b.days || 7));
    if (!(days >= 1 && days <= 60)) return bad('Durée : 1 à 60 jours');
    const message = String(b.message || '').trim().slice(0, 140) || null;
    await prisma.supplierPromo.updateMany({ where: { companyId: s.companyId, productId: product.id, active: true }, data: { active: false } });
    const promo = await prisma.supplierPromo.create({ data: { companyId: s.companyId, productId: product.id, promoPrice, message, endsAt: new Date(Date.now() + days * 86400_000) } });

    let notified = 0, capped = false;
    if (b.notify) {
      const since = new Date(Date.now() - 86400_000);
      const sentToday = await prisma.supplierPromo.count({ where: { companyId: s.companyId, notified: { gt: 0 }, createdAt: { gte: since } } });
      if (sentToday >= MAX_NOTIFY_PER_DAY) capped = true;
      else {
        const shops = await prisma.supplierOrder.findMany({ where: { companyId: s.companyId }, distinct: ['shopId'], select: { shopId: true }, take: 300 });
        const pct = Math.round((1 - promoPrice / regular) * 100);
        const title = `Promo ${s.companyName} : -${pct} %`;
        const text = `${product.name} à ${promoPrice.toFixed(3)} DT au lieu de ${regular.toFixed(3)} DT, pendant ${days} jour${days > 1 ? 's' : ''}.${message ? ' ' + message : ''}`;
        for (const x of shops) {
          try { await notifyShop(x.shopId, title, text, '/app/suppliers?q=' + encodeURIComponent(product.name), NotificationType.INFO, undefined, { experienceKey: 'SHOP_SUPPLIER_PROMO', eventId: promo.id + '-' + x.shopId }); notified++; } catch { /* une boutique ne bloque pas les autres */ }
        }
        await prisma.supplierPromo.update({ where: { id: promo.id }, data: { notified } });
      }
    }
    return ok({ ...plain(promo), notified, capped }, { status: 201 });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

/** Arrêter une promotion avant sa fin. */
export async function PATCH(req: Request) {
  try {
    const s = await requireSupplierRole(EDITORS);
    const b = await req.json().catch(() => ({}));
    const r = await prisma.supplierPromo.updateMany({ where: { id: String(b.id || ''), companyId: s.companyId }, data: { active: false } });
    if (!r.count) return bad('Promotion introuvable', 404);
    return ok({ ok: true });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
