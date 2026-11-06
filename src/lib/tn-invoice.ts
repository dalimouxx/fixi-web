/**
 * Factures conformes (Tunisie) pour l'atelier :
 *  - numérotation continue par type et par année : FAC-2026-000001, DEV-2026-000001 ;
 *  - droit de timbre fiscal (1,000 DT) ajouté au total TTC des factures ;
 *  - montant total écrit en toutes lettres (« Arrêtée la présente facture à la somme de … »).
 */

export const FISCAL_STAMP_TND = 1;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** Totaux HT / remise / TVA / timbre / TTC. */
export function tnTotals(lines: { quantity: number; unitPrice: number }[], discount = 0, taxRate = 0, stamp = 0) {
  const subtotal = r3(lines.reduce((s, l) => s + Number(l.quantity) * Number(l.unitPrice), 0));
  const safeDiscount = r3(Math.min(Math.max(Number(discount) || 0, 0), subtotal));
  const taxable = r3(Math.max(0, subtotal - safeDiscount));
  const safeTax = Math.max(0, Number(taxRate) || 0);
  const taxAmount = r3(taxable * safeTax / 100);
  const stampDuty = r3(Math.max(0, Number(stamp) || 0));
  return { subtotal, discount: safeDiscount, taxRate: safeTax, taxAmount, stampDuty, total: r3(taxable + taxAmount + stampDuty) };
}

/** Numéro suivant (dans une transaction) : jamais de trou, jamais de doublon. */
export async function nextShopNumber(tx: { shopSequence: { upsert: (a: any) => Promise<{ value: number }> } }, shopId: string, type: 'INVOICE' | 'QUOTE' | 'CREDIT_NOTE', prefix: string, date = new Date()) {
  const year = date.getFullYear();
  const seq = await tx.shopSequence.upsert({ where: { shopId_key: { shopId, key: `${type}-${year}` } }, update: { value: { increment: 1 } }, create: { shopId, key: `${type}-${year}`, value: 1 } });
  return formatNumber(prefix, year, seq.value);
}
export function formatNumber(prefix: string, year: number, n: number) {
  const p = String(prefix || 'FAC').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'FAC';
  return `${p}-${year}-${String(n).padStart(6, '0')}`;
}

const UNITS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
const TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];

function below100(n: number): string {
  if (n < 20) return UNITS[n];
  const t = Math.floor(n / 10), u = n % 10;
  if (t === 7 || t === 9) { const rest = (t === 7 ? 10 : 10) + u; return TENS[t] + (t === 7 && u === 1 ? '-et-' : '-') + UNITS[rest]; }
  if (u === 0) return TENS[t] + (t === 8 ? 's' : '');
  return TENS[t] + (u === 1 && t !== 8 ? '-et-' : '-') + UNITS[u];
}
function below1000(n: number): string {
  const h = Math.floor(n / 100), r = n % 100;
  const head = h === 0 ? '' : h === 1 ? 'cent' : UNITS[h] + '-cent' + (r === 0 ? 's' : '');
  return [head, r ? below100(r) : ''].filter(Boolean).join('-');
}
/** Nombre entier en lettres (orthographe rectifiée 1990 : traits d'union partout). */
export function integerInWords(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n === 0) return 'zéro';
  const parts: string[] = [];
  const billions = Math.floor(n / 1e9), millions = Math.floor(n / 1e6) % 1000, thousands = Math.floor(n / 1000) % 1000, rest = n % 1000;
  if (billions) parts.push(below1000(billions) + '-milliard' + (billions > 1 ? 's' : ''));
  if (millions) parts.push(below1000(millions) + '-million' + (millions > 1 ? 's' : ''));
  if (thousands) parts.push(thousands === 1 ? 'mille' : below1000(thousands).replace(/cents$/, 'cent') + '-mille');
  if (rest) parts.push(below1000(rest));
  return parts.join('-');
}
/** « deux-cent-trente-neuf dinars et cinq-cents millimes » */
export function amountInWords(amount: number, currency = 'dinar', sub = 'millime') {
  const total = Math.round(Math.abs(Number(amount) || 0) * 1000);
  const d = Math.floor(total / 1000), m = total % 1000;
  const dPart = `${integerInWords(d)} ${currency}${d > 1 ? 's' : ''}`;
  return m ? `${dPart} et ${integerInWords(m)} ${sub}${m > 1 ? 's' : ''}` : dPart;
}
