import { NotificationType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSupplierRole } from '@/lib/supplier-auth';
import { bad, ok } from '@/lib/http';
import { plain } from '@/lib/serializers';
import { notifyShop } from '@/lib/notifications';
import { autoSku, fillGuesses } from '@/lib/supplier-product-quick';
import { activePromos } from '@/lib/promos';
import { parseAmount } from '@/lib/product-quick';
import { DELAYS, requestVisible } from '@/lib/commerce';

const ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'SALES'] as const;
export const dynamic = 'force-dynamic';

/** Demandes ouvertes visibles par ce fournisseur (sa région + nationales), avec sa propre réponse éventuelle. */
export async function GET() {
  try {
    const s = await requireSupplierRole(ROLES);
    const me = await prisma.supplierCompany.findUnique({ where: { id: s.companyId }, select: { region: true } });
    const rows = await prisma.supplierPartRequest.findMany({ where: { status: 'OPEN', expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' }, take: 200, include: { shop: { select: { name: true, region: true } }, quotes: { select: { companyId: true, price: true, status: true, productId: true, delay: true } } } });
    return ok(plain(rows.filter(r => requestVisible(r.scope, r.region, me?.region)).slice(0, 60).map(r => ({ id: r.id, partName: r.partName, deviceModel: r.deviceModel, quantity: r.quantity, note: r.note, scope: r.scope, region: r.region, shopName: r.shop.name, createdAt: r.createdAt, expiresAt: r.expiresAt, offers: r.quotes.length, mine: r.quotes.find(q => q.companyId === s.companyId) || null }))));
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

/** Répondre : avec un produit existant (son prix actuel) ou en créant la fiche au prix proposé. */
export async function POST(req: Request) {
  try {
    const s = await requireSupplierRole(ROLES);
    const b = await req.json().catch(() => ({}));
    const me = await prisma.supplierCompany.findUnique({ where: { id: s.companyId }, select: { region: true, name: true } });
    const r = await prisma.supplierPartRequest.findFirst({ where: { id: String(b.requestId || ''), status: 'OPEN', expiresAt: { gt: new Date() } } });
    if (!r || !requestVisible(r.scope, r.region, me?.region)) return bad('Demande introuvable ou expirée', 404);
    const quantity = Math.trunc(Number(b.quantity || r.quantity));
    if (!(quantity >= 1 && quantity <= 500)) return bad('Quantité invalide');
    const delay = DELAYS[String(b.delay)] ? String(b.delay) : 'TODAY';
    let product = b.productId ? await prisma.supplierProduct.findFirst({ where: { id: String(b.productId), companyId: s.companyId, active: true } }) : null;
    let price: number;
    if (product) {
      // Prix réel payé par l'atelier : prix du catalogue (ou promo en cours) — pas de prix caché.
      price = (await activePromos([product.id])).get(product.id)?.price ?? Number(product.price);
      const free = product.stock - product.reservedStock;
      if (free < 1) return bad('Cette fiche est en rupture : réapprovisionnez-la ou proposez une nouvelle fiche', 409);
      if (quantity > free) return bad(`Seulement ${free} en stock sur cette fiche`, 409);
    } else {
      price = parseAmount(b.price);
      if (!Number.isFinite(price) || price <= 0) return bad('Indiquez votre prix');
      const name = String(b.name || r.partName + (r.deviceModel ? ' ' + r.deviceModel : '')).trim().slice(0, 160);
      const g = fillGuesses({ name });
      product = await prisma.supplierProduct.create({ data: { companyId: s.companyId, sku: await autoSku(s.companyId, name, g.category), name, ...g, price, retailPrice: price, purchasePrice: 0, averageCost: 0, stock: quantity, reservedStock: 0, minOrderQty: 1, active: true } });
    }
    const q = await prisma.supplierPartQuote.upsert({ where: { requestId_companyId: { requestId: r.id, companyId: s.companyId } }, update: { productId: product.id, price, quantity, delay, message: String(b.message || '').slice(0, 200) || null, status: 'OFFERED' }, create: { requestId: r.id, companyId: s.companyId, productId: product.id, price, quantity, delay, message: String(b.message || '').slice(0, 200) || null } });
    await notifyShop(r.shopId, `Réponse à votre demande : ${r.partName}`, `${me?.name} : ${price.toFixed(3)} DT · ${quantity} dispo · ${DELAYS[delay]}.`, '/app/suppliers?tab=requests', NotificationType.INFO, undefined, { experienceKey: 'SHOP_SUPPLIER_PROMO', eventId: 'pq-' + q.id }).catch(() => {});
    return ok(plain(q), { status: 201 });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
