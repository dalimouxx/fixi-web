import { prisma } from './prisma';

/** Promotions en cours pour une liste de produits : productId → prix promo (le plus bas si plusieurs). */
export async function activePromos(productIds: string[], now = new Date()) {
  if (!productIds.length) return new Map<string, { price: number; endsAt: Date; message: string | null }>();
  const rows = await prisma.supplierPromo.findMany({ where: { productId: { in: productIds }, active: true, startsAt: { lte: now }, endsAt: { gt: now } }, select: { productId: true, promoPrice: true, endsAt: true, message: true } });
  const m = new Map<string, { price: number; endsAt: Date; message: string | null }>();
  for (const r of rows) { const p = Number(r.promoPrice); const cur = m.get(r.productId); if (!cur || p < cur.price) m.set(r.productId, { price: p, endsAt: r.endsAt, message: r.message }); }
  return m;
}

/** Applique la promo à une fiche produit marketplace : price = prix payé, regularPrice = prix barré. */
export function withPromo<T extends { id: string; price: any }>(p: T, promos: Map<string, { price: number; endsAt: Date; message: string | null }>) {
  const pr = promos.get(p.id);
  if (!pr || pr.price >= Number(p.price)) return { ...p, price: Number(p.price), regularPrice: null as number | null, promoEndsAt: null as Date | null, promoMessage: null as string | null };
  return { ...p, price: pr.price, regularPrice: Number(p.price), promoEndsAt: pr.endsAt, promoMessage: pr.message };
}
