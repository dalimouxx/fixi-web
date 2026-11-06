/** Téléphones d'occasion : règles pures (validation, libellés, étiquette). */

export const CONDITIONS = [
  ['NEUF', 'Neuf (jamais utilisé)'],
  ['COMME_NEUF', 'Comme neuf'],
  ['EXCELLENT', 'Excellent état'],
  ['TRES_BON', 'Très bon état'],
  ['BON', 'Bon état'],
  ['CORRECT', 'État correct'],
  ['POUR_PIECES', 'Pour pièces'],
] as const;
export type Condition = typeof CONDITIONS[number][0];
export const conditionLabel = (c: string) => CONDITIONS.find(x => x[0] === c)?.[1] || c;
export const STORAGE_OPTIONS = [16, 32, 64, 128, 256, 512, 1024];

/** Pièce d'identité du vendeur : CIN tunisienne (8 chiffres) ou passeport / carte de séjour (6 à 20 caractères). */
export function validateSellerId(type: string, raw: string) {
  const v = String(raw || '').toUpperCase().replace(/\s+/g, '');
  if (type === 'CIN') { if (!/^\d{8}$/.test(v)) return { ok: false as const, error: 'Le numéro de CIN contient 8 chiffres' }; }
  else if (!/^[A-Z0-9]{6,20}$/.test(v)) return { ok: false as const, error: 'Numéro de pièce d’identité invalide' };
  return { ok: true as const, value: v, last3: v.slice(-3) };
}
export const maskId = (last3: string) => `•••••${last3}`;

/** « iPhone 15 Pro · 256 Go · Excellent état · Batterie 80 % » */
export function deviceTitle(d: { brand?: string | null; model: string; storageGb?: number | null }) {
  const model = String(d.model || '').trim();
  const brand = String(d.brand || '').trim();
  const name = brand && !model.toLowerCase().startsWith(brand.toLowerCase()) && !/^iphone/i.test(model) ? `${brand} ${model}` : model;
  return [name, d.storageGb ? storageLabel(d.storageGb) : ''].filter(Boolean).join(' · ');
}
export const storageLabel = (gb: number) => gb >= 1024 ? `${gb / 1024} To` : `${gb} Go`;

/** Prix de vente suggéré : marge selon l'état (plus l'état est bon, plus la marge est sûre), arrondi à 5 DT. */
export function suggestedPrice(purchasePrice: number, condition: string) {
  if (!(purchasePrice > 0)) return null;
  const margin = condition === 'POUR_PIECES' ? 0.2 : ['NEUF', 'COMME_NEUF', 'EXCELLENT'].includes(condition) ? 0.25 : 0.3;
  return Math.ceil(purchasePrice * (1 + margin) / 5) * 5;
}

/** Contrôles avant achat : IMEI valide et non signalé, prix, vendeur majeur (identité requise). */
export function purchaseIssues(d: { model?: string; imei?: string; purchasePrice?: number; sellerName?: string; batteryHealth?: number | null }, imeiValid: boolean) {
  const out: string[] = [];
  if (!String(d.model || '').trim()) out.push('modèle');
  if (!d.imei || !imeiValid) out.push('IMEI valide (15 chiffres, composez *#06#)');
  if (!(Number(d.purchasePrice) > 0)) out.push('prix d’achat');
  if (String(d.sellerName || '').trim().length < 3) out.push('nom du vendeur');
  if (d.batteryHealth != null && (d.batteryHealth < 0 || d.batteryHealth > 100)) out.push('santé batterie entre 0 et 100 %');
  return out;
}

/** Jamais la pièce d'identité en clair dans une liste. */
export function publicRow<T extends { sellerIdEncrypted?: unknown; sellerIdLast3: string }>(d: T) { const { sellerIdEncrypted, ...rest } = d as any; return { ...rest, sellerIdMasked: maskId(d.sellerIdLast3) }; }
