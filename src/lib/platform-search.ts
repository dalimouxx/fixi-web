/** Recherche globale de Fixi Control : normalisation de la requête. */
export function searchTerms(raw: unknown) {
  const q = String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const digits = q.replace(/\D/g, '');
  // Téléphone tunisien : on ignore l'indicatif 216 pour retrouver « 22 123 456 » comme « +216 22123456 ».
  const phone = digits.length >= 4 ? (digits.length > 8 && digits.startsWith('216') ? digits.slice(3) : digits) : '';
  return { q, phone, ok: q.length >= 2 };
}
export type SearchHit = { kind: 'SHOP' | 'SUPPLIER' | 'USER' | 'SUPPLIER_ACCOUNT' | 'CLIENT' | 'REPAIR'; id: string; title: string; subtitle: string; shopId?: string; companyId?: string; targetName?: string; active?: boolean };
