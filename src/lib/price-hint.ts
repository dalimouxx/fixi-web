// Prix conseillé du réseau : statistiques sur les réparations d'autres ateliers, jamais affichées sous 3 ateliers.
export const MIN_SHOPS = 3;

const ISSUES: [string, RegExp][] = [
  ['ecran', /(écran|ecran|afficheur|lcd|oled|vitre avant|tactile|شاشة)/i],
  ['batterie', /(batterie|battery|بطارية)/i],
  ['charge', /(connecteur|charge|usb|شحن)/i],
  ['camera', /(caméra|camera|كاميرا)/i],
  ['eau', /(oxyd|eau|ماء)/i],
  ['vitre-arriere', /(vitre arri|dos|back)/i],
  ['son', /(haut[- ]parleur|micro|son|écouteur)/i],
  ['logiciel', /(logiciel|bloqu|flash|virus|compte|فك)/i],
  ['allumage', /(allume|démarre|demarre|يشتغل)/i],
];

/** Famille de panne à partir du texte libre (« Écran cassé / affichage » → « ecran »). */
export function issueFamily(text: string | null | undefined) {
  const t = String(text || '');
  for (const [k, r] of ISSUES) if (r.test(t)) return k;
  return null;
}

export const normModel = (s: string | null | undefined) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

function quantile(sorted: number[], q: number) {
  const pos = (sorted.length - 1) * q; const lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** Médiane et fourchette (25 %–75 %) ; null si trop peu d'ateliers différents. */
export function priceStats(rows: { price: number; shopId: string }[], minShops = MIN_SHOPS) {
  const ok = rows.filter(r => Number.isFinite(r.price) && r.price > 0);
  const shops = new Set(ok.map(r => r.shopId)).size;
  if (shops < minShops) return null;
  const v = ok.map(r => r.price).sort((a, b) => a - b);
  const round = (n: number) => Math.round(n);
  return { median: round(quantile(v, .5)), low: round(quantile(v, .25)), high: round(quantile(v, .75)), repairs: v.length, shops };
}

const PART_WORD: Record<string, string> = { ecran: 'écran', batterie: 'batterie', charge: 'connecteur', camera: 'caméra', 'vitre-arriere': 'vitre', son: 'haut-parleur' };
/** Recherche à lancer dans le catalogue fournisseur pour une réparation (« écran Galaxy A54 »). */
export function partQuery(r: { model?: string | null; reportedIssue?: string | null }) {
  const f = issueFamily(r.reportedIssue);
  return [f && PART_WORD[f], r.model].filter(Boolean).join(' ').trim();
}
