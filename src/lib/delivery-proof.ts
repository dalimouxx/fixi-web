import { prisma } from './prisma';

/**
 * Livraison « légère » pour les listes : sans la photo ni la signature (images de plusieurs centaines de Ko).
 * La preuve se charge à la demande avec /…/orders/[id]/proof.
 */
export const LIGHT_DELIVERY = {
  select: {
    id: true, orderId: true, status: true, driverAccountId: true, driverName: true, driverPhone: true, trackingNote: true,
    recipientName: true, recipientPhone: true, proofCode: true, cashDue: true, cashCollected: true, deliveryFee: true,
    attemptCount: true, exceptionStatus: true, returnCondition: true, returnNote: true, returnedAt: true, assignedAt: true,
    acceptedAt: true, pickedUpAt: true, arrivedAt: true, deliveredAt: true, partnerCompanyId: true, courierFee: true, updatedAt: true,
  },
} as const;

/** Ajoute hasProof / hasSignature aux commandes d'une liste. */
export async function withProofFlags<T extends { id: string; delivery?: any }>(orders: T[]) {
  const ids = orders.filter(o => o.delivery?.deliveredAt).map(o => o.id);
  if (!ids.length) return orders;
  const rows = await prisma.supplierDelivery.findMany({ where: { orderId: { in: ids }, OR: [{ proofUrl: { not: null } }, { signatureUrl: { not: null } }] }, select: { orderId: true, proofUrl: true, signatureUrl: true } });
  // On ne garde que des booléens : les images ne sortent pas d'ici.
  const flags = new Map(rows.map(r => [r.orderId, { hasProof: !!r.proofUrl, hasSignature: !!r.signatureUrl }]));
  return orders.map(o => o.delivery ? { ...o, delivery: { ...o.delivery, ...(flags.get(o.id) || { hasProof: false, hasSignature: false }) } } : o);
}

/** Preuve complète d'une livraison (une seule commande). */
export async function deliveryProof(where: any) {
  const o = await prisma.supplierOrder.findFirst({ where, select: { id: true, reference: true, status: true, shop: { select: { name: true } }, company: { select: { name: true } }, delivery: { select: { deliveredAt: true, recipientName: true, recipientPhone: true, driverName: true, proofUrl: true, signatureUrl: true, proofCode: true } } } });
  if (!o) return null;
  return { reference: o.reference, shopName: o.shop.name, companyName: o.company.name, ...o.delivery, proofCode: undefined, codeVerified: !!o.delivery?.proofCode };
}
