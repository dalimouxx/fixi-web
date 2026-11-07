import { guessProduct } from './product-quick';

/**
 * Code-barres intelligent des produits fournisseur, facile à taper à la main si la douchette ne marche pas :
 *   4 chiffres = type de pièce, puis le modèle du téléphone.
 *   Afficheur Samsung A04 → 0000A04 · Batterie iPhone 13 → 0001IP13 · Connecteur Redmi Note 12 → 0002RN12
 * Un code n'appartient qu'à UN produit sur toute la plateforme : si 0000A04 existe déjà (même chez un autre
 * fournisseur), le suivant devient 0000A04-2, puis 0000A04-3…
 */
export const TYPE_CODES: Record<string, string> = {
  'Écrans': '0000', 'Batteries': '0001', 'Connecteurs de charge': '0002', 'Vitres arrière': '0003', 'Caméras': '0004',
  'Nappes': '0005', 'Haut-parleurs': '0006', 'Châssis': '0007', 'Boutons': '0008', 'Protections': '0009',
  'Chargeurs & câbles': '0010', 'Audio': '0011', 'Cartes mères': '0012', 'Outils': '0013',
};
export const OTHER_TYPE = '0099';

const clean = (s: string) => ` ${String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9+]+/g, ' ').trim()} `;

/** Modèle du téléphone en quelques caractères : A04, IP13PM, RN12, R9A, PX3, S23U… ('' si aucun). */
export function modelCode(name: string): string {
  const n = clean(name);
  let m: RegExpMatchArray | null;
  // iPhone 13 Pro Max → IP13PM ; iPhone XR → IPXR ; iPhone SE → IPSE
  if ((m = n.match(/ (?:IPHONE|IP) ?(\d{1,2}|XS|XR|X|SE)( ?PRO ?MAX| ?PRO| ?PLUS| ?MINI| ?MAX| ?E)?\b/))) {
    const suf = (m[2] || '').replace(/ /g, '');
    return 'IP' + m[1] + (({ PROMAX: 'PM', PRO: 'P', PLUS: 'PL', MINI: 'MI', MAX: 'M', E: 'E' } as Record<string, string>)[suf] ?? '');
  }
  if ((m = n.match(/ IPAD ?(PRO|AIR|MINI)? ?(\d{1,2})?\b/))) return 'IPAD' + (m[1] ? m[1][0] : '') + (m[2] || '');
  // Xiaomi
  if ((m = n.match(/ REDMI NOTE ?(\d{1,2})( ?PRO ?PLUS| ?PRO\+?| ?S)?\b/))) return 'RN' + m[1] + ((m[2] || '').includes('PRO') ? ((m[2] || '').includes('PLUS') || (m[2] || '').includes('+') ? 'PP' : 'P') : (m[2] || '').trim());
  if ((m = n.match(/ REDMI ?(\d{1,2}[A-Z]?)\b/))) return 'R' + m[1];
  if ((m = n.match(/ POCO ?([A-Z]\d{1,2}(?: ?PRO)?)\b/))) return 'P' + m[1].replace(/ ?PRO/, 'P');
  if ((m = n.match(/ MI ?(\d{1,2}[A-Z]?)( ?LITE| ?PRO)?\b/))) return 'MI' + m[1] + (m[2] ? m[2].trim()[0] : '');
  // Tecno / Infinix
  if ((m = n.match(/ SPARK ?(\d{1,2}[A-Z]?)( ?PRO)?\b/))) return 'SP' + m[1] + (m[2] ? 'P' : '');
  if ((m = n.match(/ CAMON ?(\d{1,2}[A-Z]?)( ?PRO)?\b/))) return 'CM' + m[1] + (m[2] ? 'P' : '');
  if ((m = n.match(/ POVA ?(\d{1,2}[A-Z]?)\b/))) return 'PV' + m[1];
  if ((m = n.match(/ HOT ?(\d{1,2}[A-Z]?)\b/))) return 'H' + m[1];
  if ((m = n.match(/ SMART ?(\d{1,2}[A-Z]?)\b/))) return 'SM' + m[1];
  // Samsung Galaxy : A04, A04S, A54, S23 ULTRA, M31, J7, NOTE 10
  if ((m = n.match(/ (?:GALAXY )?NOTE ?(\d{1,2})( ?PLUS| ?ULTRA| ?LITE)?\b/))) return 'N' + m[1] + (m[2] ? m[2].trim()[0] : '');
  if ((m = n.match(/ ([ASMJZ]) ?(\d{1,3})( ?S| ?E| ?ULTRA| ?PLUS| ?FE|\+)?\b/))) {
    const s = (m[3] || '').replace(/ /g, '');
    return m[1] + m[2] + (({ S: 'S', E: 'E', ULTRA: 'U', PLUS: 'P', '+': 'P', FE: 'FE' } as Record<string, string>)[s] ?? '');
  }
  // Séries nommées : Nova 9, Reno 8, Pixel 7, Mate 20, Realme 10…
  if ((m = n.match(/ (NOVA|MATE|RENO|PIXEL|MOTO|NARZO|BLADE|REALME|HONOR) ?(\d{1,2}[A-Z]?)\b/))) return (m[1] === 'REALME' ? 'RM' : m[1] === 'HONOR' ? 'HN' : m[1]) + m[2];
  // Autres marques : premier mot qui mélange lettres et chiffres (Y21, C25, P30…), jamais une unité (20W, 1M, 65W).
  const token = n.trim().split(' ').find(t => /\d/.test(t) && /[A-Z]/.test(t) && t.length <= 8 && !/^\d+(W|M|MAH|MM|CM|GB|TO|GO|V|A|MAH)$/.test(t) && !/^USB/.test(t));
  return token || '';
}

/** Type de pièce sur 4 chiffres, depuis la catégorie du produit ou son nom. */
export function typeCode(name: string, category?: string | null) {
  if (category && TYPE_CODES[category]) return TYPE_CODES[category];
  const g = guessProduct(name);
  return (g.category && TYPE_CODES[g.category]) || OTHER_TYPE;
}

/** Base du code : 0000A04. Sans modèle reconnu : 4 chiffres + numéro (00090001…), voir nextFreeCode. */
export function smartBase(name: string, category?: string | null) {
  return typeCode(name, category) + modelCode(name);
}

/** Premier code libre pour cette base, parmi les codes déjà pris sur toute la plateforme. */
export function nextFreeCode(base: string, taken: Iterable<string>) {
  const set = new Set([...taken].map(t => t.toUpperCase()));
  if (/^\d{4}$/.test(base)) { // pas de modèle : 0099 + numéro sur 4 chiffres
    for (let i = 1; i < 100000; i++) { const c = base + String(i).padStart(4, '0'); if (!set.has(c)) return c; }
  }
  if (!set.has(base)) return base;
  for (let i = 2; i < 100000; i++) { const c = `${base}-${i}`; if (!set.has(c)) return c; }
  return `${base}-${Date.now().toString(36).toUpperCase()}`;
}

/** Code tapé à la main : on ignore espaces et minuscules (« 0000 a04 » = 0000A04). */
export function cleanTyped(code: unknown) {
  return String(code ?? '').toUpperCase().replace(/\s+/g, '').slice(0, 64);
}
