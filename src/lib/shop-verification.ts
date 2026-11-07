/**
 * Vérification des ateliers (Fixi Control).
 * NONE : rien envoyé · PENDING : documents envoyés, en attente · VERIFIED : validé · REJECTED : refusé (motif).
 * Tant que l'atelier n'est pas VERIFIED, il ne voit pas les produits des fournisseurs et ne peut pas commander.
 */
export const VERIFICATION_STATUSES = ['NONE', 'PENDING', 'VERIFIED', 'REJECTED'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];
export const isVerified = (s?: string | null) => s === 'VERIFIED';
export const VERIFICATION_REQUIRED = 'VERIFICATION_REQUISE';

export const VERIFICATION_LABEL: Record<string, string> = {
  NONE: 'Non vérifié', PENDING: 'Vérification en cours', VERIFIED: 'Atelier vérifié', REJECTED: 'Vérification refusée',
};

/**
 * Matricule fiscal tunisien : 7 chiffres + lettre de contrôle, puis (facultatif) code TVA, catégorie et établissement.
 * Accepte « 1234567A », « 1234567/A », « 1234567A/A/M/000 », « 1234567 A A M 000 ».
 */
export function normalizeTaxId(raw: unknown): string | null {
  const v = String(raw ?? '').toUpperCase().replace(/[\s./-]+/g, '');
  const m = v.match(/^(\d{7})([A-Z])([ABDNP])?([MPCNE])?(\d{3})?$/);
  if (!m) return null;
  return [m[1] + m[2], m[3], m[4], m[5]].filter(Boolean).join('/');
}

/** Image envoyée par le navigateur (déjà compressée) : data URL JPEG/PNG/WebP < 1,6 Mo. */
export function imageOk(v: unknown): v is string {
  return typeof v === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(v) && v.length < 1_600_000;
}

export type VerificationInput = { legalName: string; ownerName: string; taxId: string; tradeRegister: string | null; address: string; city: string | null; documentUrl: string; facadeUrl: string; insideUrl: string | null };

export function checkVerification(b: any): { ok: true; value: VerificationInput } | { ok: false; error: string } {
  const t = (k: string, max = 160) => String(b?.[k] ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  const legalName = t('legalName'), ownerName = t('ownerName'), address = t('address', 240);
  if (legalName.length < 2) return { ok: false, error: 'Nom commercial ou raison sociale requis' };
  if (ownerName.length < 3) return { ok: false, error: 'Nom et prénom du gérant requis' };
  const taxId = normalizeTaxId(b?.taxId);
  if (!taxId) return { ok: false, error: 'Matricule fiscal invalide (ex. 1234567A/A/M/000)' };
  if (address.length < 5) return { ok: false, error: 'Adresse de l’atelier requise' };
  if (!imageOk(b?.documentUrl)) return { ok: false, error: 'Photo de la patente ou du registre de commerce requise' };
  if (!imageOk(b?.facadeUrl)) return { ok: false, error: 'Photo de la façade de l’atelier requise' };
  return { ok: true, value: { legalName, ownerName, taxId, tradeRegister: t('tradeRegister', 40) || null, address, city: t('city', 80) || null, documentUrl: b.documentUrl, facadeUrl: b.facadeUrl, insideUrl: imageOk(b?.insideUrl) ? b.insideUrl : null } };
}

/** Serveur : refuse l'accès aux produits fournisseurs tant que l'atelier n'est pas vérifié. */
export async function requireVerifiedShop(shopId: string) {
  const { prisma } = await import('./prisma');
  const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { verificationStatus: true } });
  if (!isVerified(shop?.verificationStatus))
    throw Object.assign(new Error('Votre atelier doit être vérifié par Fixi pour voir les produits des fournisseurs. Envoyez vos documents dans Commander une pièce → Vérification.'), { status: 403, code: VERIFICATION_REQUIRED });
}
