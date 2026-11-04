import { currentSupplierOffer, supplierOfferState } from './supplier-saas';

/** Livreurs partenaires : inclus dans l'abonnement fournisseur actif (pas pendant l'essai). */
export async function partnerCouriersAllowed(companyId: string) {
  const state = supplierOfferState(await currentSupplierOffer(companyId));
  return state === 'ACTIVE' || state === 'LEGACY';
}

export const PARTNER_REFUSED = 'Les livreurs partenaires sont inclus dans l’abonnement Fixi Fournisseur actif (non disponible pendant l’essai).';
