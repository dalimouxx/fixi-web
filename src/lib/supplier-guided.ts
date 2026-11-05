/**
 * Création guidée de produits fournisseur (Fixi Max) : règles pures, testables.
 * Type de pièce → marque → modèle(s) → qualités ⇒ une variante (un produit) par qualité.
 */

export type PartType = { id: string; label: string; icon: string; qualities: string[] };

/** Types de pièces les plus vendus, avec les qualités courantes pour chacun. */
export const PART_TYPES: PartType[] = [
  { id: 'ecran', label: 'Écran', icon: 'screen', qualities: ['Original', 'Service Pack', 'OLED', 'Incell', 'TFT', 'Copie'] },
  { id: 'batterie', label: 'Batterie', icon: 'battery', qualities: ['Original', 'Compatible', 'Haute capacité'] },
  { id: 'connecteur', label: 'Connecteur de charge', icon: 'plug', qualities: ['Original', 'Compatible'] },
  { id: 'vitre', label: 'Vitre arrière', icon: 'back', qualities: ['Original', 'Compatible'] },
  { id: 'camera', label: 'Caméra arrière', icon: 'camera', qualities: ['Original', 'Compatible'] },
  { id: 'hp', label: 'Haut-parleur', icon: 'speaker', qualities: ['Original', 'Compatible'] },
  { id: 'nappe', label: 'Nappe', icon: 'flex', qualities: ['Original', 'Compatible'] },
  { id: 'chassis', label: 'Châssis', icon: 'frame', qualities: ['Original', 'Compatible'] },
  { id: 'coque', label: 'Coque', icon: 'case', qualities: ['Silicone', 'Antichoc', 'MagSafe', 'Transparente'] },
  { id: 'verre', label: 'Verre trempé', icon: 'glass', qualities: ['Standard', 'Full cover', 'Anti-espion'] },
];

/** Marques et modèles fréquents (le fournisseur peut toujours taper un autre modèle). */
export const BRAND_MODELS: Record<string, string[]> = {
  Apple: ['iPhone 11', 'iPhone 11 Pro', 'iPhone 12', 'iPhone 12 Pro', 'iPhone 13', 'iPhone 13 Pro', 'iPhone 14', 'iPhone 14 Pro', 'iPhone 15', 'iPhone 15 Pro', 'iPhone X', 'iPhone XR', 'iPhone XS'],
  Samsung: ['Galaxy A14', 'Galaxy A15', 'Galaxy A24', 'Galaxy A25', 'Galaxy A34', 'Galaxy A54', 'Galaxy A55', 'Galaxy S21', 'Galaxy S22', 'Galaxy S23', 'Galaxy S24'],
  Xiaomi: ['Redmi 12', 'Redmi 13C', 'Redmi Note 11', 'Redmi Note 12', 'Redmi Note 13', 'Poco X5', 'Poco X6'],
  Oppo: ['A17', 'A38', 'A58', 'A78', 'Reno 8', 'Reno 10'],
  Realme: ['C53', 'C55', 'Realme 11', 'Realme 12'],
  Huawei: ['P30', 'P30 Lite', 'Nova 9', 'Y9 Prime'],
  Infinix: ['Hot 30', 'Hot 40', 'Smart 7', 'Note 30'],
  Tecno: ['Spark 10', 'Spark 20', 'Camon 20'],
  Honor: ['X6', 'X7', 'X8', 'Honor 90'],
};
export const BRANDS = Object.keys(BRAND_MODELS);

/** Nom du produit généré : « Écran iPhone 13 OLED », « Batterie Galaxy A54 Original ». */
export function productName(typeLabel: string, model: string, quality: string) {
  return [typeLabel, model, quality].map(x => String(x || '').trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ');
}

/** Description qui liste les modèles compatibles (lisible par les ateliers dans le catalogue). */
export function compatDescription(models: string[]) {
  const list = [...new Set(models.map(m => m.trim()).filter(Boolean))];
  return list.length ? `Compatible : ${list.join(', ')}` : '';
}

const round = (n: number) => Math.round(n * 1000) / 1000;
/** Prix conseillés à partir du coût : vente = coût × (1 + marge), gros = vente − remise. */
export function suggestPrices(cost: number, marginPct = 30, wholesaleDiscountPct = 5) {
  if (!(cost > 0)) return { price: null as number | null, wholesalePrice: null as number | null };
  const price = Math.ceil(cost * (1 + marginPct / 100));
  return { price, wholesalePrice: round(Math.max(cost, price * (1 - wholesaleDiscountPct / 100))) };
}

/** Marge en % (sur le prix de vente) ; null si incalculable. */
export function marginOf(cost: number, price: number) {
  if (!(cost > 0) || !(price > 0)) return null;
  return Math.round((price - cost) / price * 100);
}

export type VariantInput = { quality: string; purchasePrice: string; price: string; wholesalePrice: string; stock: string; barcode?: string };

/** Corps envoyé à POST /api/supplier/products pour chaque variante. */
export function variantPayload(o: { typeLabel: string; brand: string; model: string; compat: string[]; v: VariantInput; warrantyDays?: string; location?: string; minStock?: string }) {
  const num = (s: string) => { const n = Number(String(s ?? '').replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
  return {
    name: productName(o.typeLabel, o.model, o.v.quality),
    brand: o.brand || undefined,
    qualityGrade: o.v.quality || undefined,
    price: num(o.v.price),
    purchasePrice: Number.isFinite(num(o.v.purchasePrice)) ? num(o.v.purchasePrice) : 0,
    wholesalePrice: o.v.wholesalePrice ? num(o.v.wholesalePrice) : undefined,
    stock: Math.max(0, Math.trunc(num(o.v.stock) || 0)),
    barcode: o.v.barcode?.trim() || undefined,
    description: compatDescription([o.model, ...o.compat]) || undefined,
    warrantyDays: o.warrantyDays ? Math.max(0, Math.trunc(num(o.warrantyDays) || 0)) : undefined,
    location: o.location?.trim() || undefined,
    minStock: o.minStock ? Math.max(0, Math.trunc(num(o.minStock) || 0)) : undefined,
  };
}

/** Contrôle d'une variante : `blocking` empêche la création, `warnings` informe seulement. */
export function variantIssues(v: VariantInput, existingNames: Set<string>, name: string) {
  const blocking: string[] = [], warnings: string[] = [];
  const price = Number(String(v.price).replace(',', '.'));
  if (!(price > 0)) blocking.push('prix de vente manquant');
  if (existingNames.has(name.toLowerCase())) blocking.push('existe déjà dans le catalogue');
  const cost = Number(String(v.purchasePrice).replace(',', '.'));
  if (cost > 0 && price > 0 && price < cost) warnings.push('vente inférieure au coût');
  return { blocking, warnings };
}
