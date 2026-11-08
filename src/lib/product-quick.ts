/** Ajout de produit simplifié (17.4) : règles pures, partagées par le serveur et l'écran fournisseur. */

const norm = (s: string) => ` ${String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9+]+/g, ' ').trim()} `;
const has = (n: string, words: string[]) => words.some(w => n.includes(` ${w} `) || (w.endsWith('*') && n.includes(` ${w.slice(0, -1)}`)));

/** Ordre important : la première règle qui correspond gagne (« vitre arrière » avant « vitre »). */
const CATEGORIES: [string, string, string[]][] = [
  ['Vitres arrière', 'VIT', ['vitre arriere', 'back cover', 'back glass', 'cache arriere', 'dos']],
  ['Écrans', 'ECR', ['ecran', 'lcd', 'oled', 'amoled', 'afficheur', 'display', 'incell', 'tactile', 'vitre tactile']],
  ['Batteries', 'BAT', ['batterie', 'battery', 'batt']],
  ['Connecteurs de charge', 'CON', ['connecteur', 'port de charge', 'dock', 'nappe de charge', 'charging port']],
  ['Caméras', 'CAM', ['camera', 'objectif', 'lentille']],
  ['Haut-parleurs', 'HP', ['haut parleur', 'buzzer', 'ecouteur interne', 'speaker', 'sonnerie']],
  ['Nappes', 'NAP', ['nappe', 'flex']],
  ['Boutons', 'BTN', ['bouton', 'volume', 'touche']],
  ['Châssis', 'CHA', ['chassis', 'carcasse', 'cadre', 'frame']],
  ['Cartes mères', 'CM', ['carte mere', 'ic', 'puce', 'chip']],
  ['Protections', 'PRO', ['coque', 'verre trempe', 'film', 'protection', 'etui', 'housse', 'case']],
  ['Chargeurs & câbles', 'CHG', ['chargeur', 'cable', 'adaptateur', 'charger', 'power bank', 'powerbank', 'usb', 'type c', 'lightning']],
  ['Audio', 'AUD', ['ecouteurs', 'airpods', 'casque', 'kit main libre', 'enceinte', 'earbuds']],
  ['Outils', 'OUT', ['tournevis', 'colle', 'station', 'fer a souder', 'pince', 'b7000', 't7000', 'outil']],
];

const BRANDS: [string, string, string[]][] = [
  ['Apple', 'APL', ['iphone', 'ipad', 'apple', 'airpods', 'ip']],
  ['Samsung', 'SAM', ['samsung', 'galaxy', 'sm']],
  ['Xiaomi', 'XIA', ['xiaomi', 'redmi', 'poco', 'mi']],
  ['Oppo', 'OPP', ['oppo']], ['Realme', 'RLM', ['realme']], ['Huawei', 'HUA', ['huawei']], ['Honor', 'HON', ['honor']],
  ['Infinix', 'INF', ['infinix']], ['Tecno', 'TEC', ['tecno']], ['Itel', 'ITL', ['itel']], ['Nokia', 'NOK', ['nokia']],
  ['Vivo', 'VIV', ['vivo']], ['OnePlus', 'ONE', ['oneplus']], ['Google', 'GOO', ['pixel', 'google']], ['Motorola', 'MOT', ['motorola', 'moto']],
  ['Lenovo', 'LEN', ['lenovo']], ['Condor', 'CDR', ['condor']], ['Evertek', 'EVT', ['evertek']],
];

const QUALITIES: [string, string[]][] = [
  ['Service Pack', ['service pack', 'sp']], ['Original', ['original', 'origine', 'orig', 'ori']], ['OLED', ['oled', 'amoled']],
  ['Incell', ['incell']], ['TFT', ['tft']], ['Copie', ['copie', 'copy', 'aaa', 'compatible']],
];

export type ProductGuess = { category: string | null; brand: string | null; qualityGrade: string | null; categoryCode: string; brandCode: string };

/** Devine catégorie, marque et qualité depuis le nom tapé (« Écran iPhone 13 OLED » → Écrans, Apple, OLED). */
export function guessProduct(name: string): ProductGuess {
  const n = norm(name);
  const c = CATEGORIES.find(([, , w]) => has(n, w));
  const b = BRANDS.find(([, , w]) => has(n, w));
  const q = QUALITIES.find(([, w]) => has(n, w));
  return { category: c?.[0] ?? null, brand: b?.[0] ?? null, qualityGrade: q?.[0] ?? null, categoryCode: c?.[1] ?? 'ART', brandCode: b?.[1] ?? '' };
}

export const CATEGORY_NAMES = CATEGORIES.map(c => c[0]);

/** Préfixe lisible du SKU automatique : ECR-APL, BAT-SAM, ART… */
export function skuPrefix(g: Pick<ProductGuess, 'categoryCode' | 'brandCode'>) {
  return [g.categoryCode || 'ART', g.brandCode].filter(Boolean).join('-');
}

/** Prochain numéro libre pour un préfixe, à partir des SKU existants (ECR-APL-0007 → ECR-APL-0008). */
export function nextSku(prefix: string, existing: string[]) {
  const re = new RegExp(`^${prefix.replace(/[-]/g, '\\-')}-(\\d+)$`);
  const max = existing.reduce((m, s) => { const x = re.exec(String(s).toUpperCase()); return x ? Math.max(m, Number(x[1])) : m; }, 0);
  return `${prefix}-${String(max + 1).padStart(4, '0')}`;
}

/** Montant tapé à la tunisienne : « 12,5 » « 12.500 » « 12 DT ». NaN si vide/illisible. */
export function parseAmount(v: unknown) {
  const s = String(v ?? '').replace(/\s|dt|tnd|د\.ت/gi, '').replace(',', '.');
  if (!s) return NaN;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 1000) / 1000 : NaN;
}

export type QuickRow = { barcode?: string; name?: string; price?: unknown; stock?: unknown; purchasePrice?: unknown; sku?: string; category?: string; brand?: string; qualityGrade?: string; line?: string };

/** Valide une ligne (ajout rapide, saisie en série, import Excel). */
export function checkRow(r: QuickRow): string | null {
  const name = String(r.name || '').trim();
  if (name.length < 2) return 'Nom manquant';
  if (name.length > 160) return 'Nom trop long';
  if (!Number.isFinite(parseAmount(r.price))) return 'Prix de vente manquant';
  const st = String(r.stock ?? '').trim();
  if (st && !/^\d{1,6}$/.test(st)) return 'Stock invalide';
  const pp = String(r.purchasePrice ?? '').trim();
  if (pp && !Number.isFinite(parseAmount(pp))) return 'Coût invalide';
  const bc = String(r.barcode || '').trim();
  if (bc && !/^[A-Za-z0-9._-]{3,64}$/.test(bc)) return 'Code-barres invalide';
  return null;
}

/** Texte collé depuis Excel (tabulations) → lignes. Colonnes : code-barres, nom, prix, stock, coût.
 *  Si la première colonne n'est pas un code (contient des espaces / pas de chiffre), on considère nom, prix, stock, coût. */
export function parsePasted(text: string): QuickRow[] {
  return String(text || '').replace(/\r/g, '').split('\n').map(l => l.split('\t').map(c => c.trim())).filter(c => c.some(Boolean)).map(c => {
    const first = c[0] || '';
    const isCode = /^[A-Za-z0-9._-]{3,64}$/.test(first) && /\d/.test(first) && c.length >= 3;
    const [barcode, name, price, stock, purchasePrice] = isCode ? c : ['', ...c];
    return { barcode, name, price, stock, purchasePrice };
  });
}

const HEAD: Record<keyof QuickRow, string[]> = {
  barcode: ['code barre', 'code barres', 'codebarre', 'barcode', 'ean', 'code'],
  name: ['nom', 'name', 'produit', 'designation', 'article', 'libelle'],
  price: ['prix', 'prix vente', 'prix de vente', 'price', 'pv', 'prix detail'],
  stock: ['stock', 'quantite', 'qte', 'qty', 'quantity'],
  purchasePrice: ['cout', 'prix achat', 'prix d achat', 'cost', 'pa', 'cout achat'],
  sku: ['sku', 'reference', 'ref'],
  category: ['categorie', 'category', 'famille'],
  brand: ['marque', 'brand'],
  line: ['ligne', 'line', 'etiquette', 'tag', 'proprietaire'],
  qualityGrade: ['qualite', 'quality', 'grade'],
};

/** Tableau (Excel/CSV) → lignes simples, en reconnaissant les en-têtes usuels en français et en anglais. */
export function rowsFromTable(table: string[][]): { rows: QuickRow[]; missing: string[] } {
  const [head = [], ...data] = table;
  const keys = head.map(h => norm(h).trim());
  const col = (f: keyof QuickRow) => keys.findIndex(k => HEAD[f].includes(k));
  const idx = Object.fromEntries((Object.keys(HEAD) as (keyof QuickRow)[]).map(f => [f, col(f)])) as Record<keyof QuickRow, number>;
  const missing = [idx.name < 0 && 'Nom', idx.price < 0 && 'Prix'].filter(Boolean) as string[];
  const rows = data.filter(r => r.some(c => String(c ?? '').trim())).map(r => {
    const o: QuickRow = {};
    for (const f of Object.keys(HEAD) as (keyof QuickRow)[]) if (idx[f] >= 0) (o as any)[f] = String(r[idx[f]] ?? '').trim();
    return o;
  });
  return { rows, missing };
}

/** Une ligne CSV (séparateur ; ou ,) avec guillemets. */
export function csvTable(text: string): string[][] {
  const lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];
  const sep = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ';' : ',';
  return lines.map(line => {
    const out: string[] = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) { const ch = line[i]; if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; } else if (ch === sep && !q) { out.push(cur.trim()); cur = ''; } else cur += ch; }
    out.push(cur.trim()); return out;
  });
}
