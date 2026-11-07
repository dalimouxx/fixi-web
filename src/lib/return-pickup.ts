import crypto from 'crypto';

/** Reprises de pièces (atelier → fournisseur) : règles partagées. */
export const PICKUP_MODES = ['DRIVER', 'SHOP_DROPOFF'] as const;
export type PickupMode = (typeof PICKUP_MODES)[number];
export const pickupMode = (v: unknown): PickupMode => (v === 'SHOP_DROPOFF' ? 'SHOP_DROPOFF' : 'DRIVER');
export const newHandoverCode = () => String(crypto.randomInt(0, 10000)).padStart(4, '0');

/** Code saisi par le livreur / le fournisseur : obligatoire si la reprise en a un (anciennes reprises : sans code). */
export function handoverOk(expected: string | null | undefined, given: unknown) {
  if (!expected) return true;
  return String(given ?? '').replace(/\D/g, '') === expected;
}

export const PICKUP_STATUS_LABEL: Record<string, string> = {
  REQUESTED: 'En attente du fournisseur', ACCEPTED: 'Acceptée', COLLECTED: 'Pièce remise', COMPLETED: 'Avoir créé', REJECTED: 'Refusée', CANCELLED: 'Annulée',
};
export function pickupStep(p: { status: string; mode?: string | null }) {
  if (p.status === 'ACCEPTED') return p.mode === 'SHOP_DROPOFF' ? 'À déposer chez le fournisseur' : 'Le livreur passe la récupérer';
  return PICKUP_STATUS_LABEL[p.status] || p.status;
}
