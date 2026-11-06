/**
 * Vente comptoir (accessoires) : règles pures, partagées par l'API et l'écran Caisse.
 * Montants en dinars avec 3 décimales (millimes).
 */

export type CounterLineInput = { itemId: string; quantity: number };
export type CounterItem = { id: string; name: string; quantity: number; salePrice: number; purchasePrice: number; active: boolean };
export type CounterSplit = { method: string; amount: number; receivedAmount?: number };

export const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Fusionne les lignes d'un même article et ignore les quantités invalides. */
export function mergeLines(lines: CounterLineInput[]) {
  const map = new Map<string, number>();
  for (const l of lines || []) {
    const q = Math.trunc(Number(l?.quantity));
    if (!l?.itemId || !(q > 0)) continue;
    map.set(String(l.itemId), (map.get(String(l.itemId)) || 0) + q);
  }
  return [...map].map(([itemId, quantity]) => ({ itemId, quantity }));
}

/** Calcule les lignes et totaux ; lève une erreur lisible si un article manque ou n'est pas en stock. */
export function priceSale(lines: CounterLineInput[], items: CounterItem[], discountInput = 0) {
  const merged = mergeLines(lines);
  if (!merged.length) throw new Error('Ajoutez au moins un article');
  if (merged.length > 60) throw new Error('Trop d’articles dans une seule vente');
  const byId = new Map(items.map(i => [i.id, i]));
  const out = merged.map(l => {
    const it = byId.get(l.itemId);
    if (!it || !it.active) throw new Error('Article introuvable ou désactivé');
    if (!(it.salePrice > 0)) throw new Error(`Prix de vente manquant : ${it.name}`);
    if (it.quantity < l.quantity) throw new Error(`Stock insuffisant : ${it.name} (${it.quantity} disponible${it.quantity > 1 ? 's' : ''})`);
    return { itemId: it.id, name: it.name, quantity: l.quantity, unitPrice: round3(it.salePrice), unitCost: round3(it.purchasePrice || 0), total: round3(it.salePrice * l.quantity) };
  });
  const subtotal = round3(out.reduce((a, l) => a + l.total, 0));
  const discount = round3(Math.max(0, Math.min(subtotal, Number(discountInput) || 0)));
  return { lines: out, subtotal, discount, total: round3(subtotal - discount) };
}

/** Vérifie que les paiements couvrent exactement le total (pas de crédit au comptoir). */
export function checkSplits(splits: CounterSplit[], total: number, allowed: Set<string>) {
  if (!Array.isArray(splits) || !splits.length) throw new Error('Choisissez un mode de paiement');
  let sum = 0;
  for (const x of splits) {
    const amount = round3(Number(x.amount));
    if (!(amount > 0)) throw new Error('Montant de paiement invalide');
    if (!allowed.has(x.method)) throw new Error('Mode de paiement invalide');
    if (x.method === 'CASH' && Number(x.receivedAmount ?? amount) + 0.0001 < amount) throw new Error('Montant reçu inférieur au montant encaissé');
    sum += amount;
  }
  if (Math.abs(round3(sum) - total) > 0.0005) throw new Error(`Le paiement doit être égal au total (${total.toFixed(3)})`);
  return round3(sum);
}

/** Numéro de vente lisible : V-000042. */
export function saleNumber(n: number) { return 'V-' + String(Math.max(1, Math.trunc(n))).padStart(6, '0'); }

/** Plafond de remise pour un caissier (le gérant n'a pas de plafond). */
export function maxDiscountFor(role: string, cashierMax: number, subtotal: number) {
  return role === 'ADMIN' ? subtotal : Math.max(0, Math.min(subtotal, Number(cashierMax) || 0));
}

export type RefundableLine = { id: string; name: string; quantity: number; returnedQuantity: number; unitPrice: number };
export type RefundRequest = { lineId: string; quantity: number; restock?: boolean };

/**
 * Remboursement d'une vente comptoir : quantités rendues par ligne, montant au prorata de la remise
 * (une remise de 10 % sur la vente s'applique aussi au remboursement), jamais plus que ce qui reste encaissé.
 */
export function priceRefund(sale: { subtotal: number; total: number; refundedTotal: number }, lines: RefundableLine[], req: RefundRequest[]) {
  const byId = new Map(lines.map(l => [l.id, l]));
  const merged = new Map<string, { quantity: number; restock: boolean }>();
  for (const r of req || []) {
    const q = Math.trunc(Number(r?.quantity));
    if (!r?.lineId || !(q > 0)) continue;
    const prev = merged.get(String(r.lineId));
    merged.set(String(r.lineId), { quantity: (prev?.quantity || 0) + q, restock: r.restock !== false });
  }
  if (lines.every(l => l.quantity - l.returnedQuantity <= 0) || sale.refundedTotal + 0.0005 >= sale.total) throw new Error('Cette vente est déjà entièrement remboursée');
  if (!merged.size) throw new Error('Choisissez au moins un article à rembourser');
  const out = [...merged].map(([lineId, x]) => {
    const l = byId.get(lineId);
    if (!l) throw new Error('Ligne de vente introuvable');
    const left = l.quantity - l.returnedQuantity;
    if (x.quantity > left) throw new Error(`${l.name} : ${left} article${left > 1 ? 's' : ''} remboursable${left > 1 ? 's' : ''} au maximum`);
    return { lineId, name: l.name, quantity: x.quantity, restock: x.restock, gross: round3(l.unitPrice * x.quantity) };
  });
  const ratio = sale.subtotal > 0 ? sale.total / sale.subtotal : 0;
  const gross = round3(out.reduce((a, l) => a + l.gross, 0));
  const remaining = round3(Math.max(0, sale.total - sale.refundedTotal));
  // Tout ce qui restait est rendu : on rembourse exactement le solde (pas d'écart d'arrondi).
  const allBack = lines.every(l => l.quantity - l.returnedQuantity === (merged.get(l.id)?.quantity || 0));
  const amount = allBack ? remaining : round3(Math.min(remaining, gross * ratio));
  if (!(amount > 0)) throw new Error('Cette vente est déjà entièrement remboursée');
  return { lines: out, amount, remaining: round3(remaining - amount) };
}

/** État lisible d'une vente : rien rendu, partiellement ou entièrement remboursée. */
export function refundState(total: number, refundedTotal: number): 'NONE' | 'PARTIAL' | 'FULL' {
  if (!(refundedTotal > 0.0004)) return 'NONE';
  return refundedTotal + 0.0005 >= total ? 'FULL' : 'PARTIAL';
}
