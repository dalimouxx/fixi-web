/** Entrée de stock au scanner (caisse fournisseur et atelier) : règles pures. */
export type StockInLine = { productId: string; quantity: number; unitCost: number | null };

export const r3 = (n: unknown) => Math.round((Number(n) || 0) * 1000) / 1000;

/** Lignes propres : fusion des doublons, quantités entières > 0, coût ≥ 0 ou null (= garder l'ancien coût). */
export function cleanStockIn(raw: unknown, max = 300): StockInLine[] {
  const map = new Map<string, StockInLine>();
  for (const x of Array.isArray(raw) ? raw : []) {
    const id = String((x as any)?.productId || (x as any)?.inventoryItemId || '').slice(0, 40);
    const q = Math.trunc(Number((x as any)?.quantity));
    if (!id || !(q > 0) || q > 100000) continue;
    const c = (x as any)?.unitCost;
    const cost = c === null || c === undefined || c === '' ? null : r3(String(c).replace(',', '.'));
    if (cost !== null && !(cost >= 0)) continue;
    const prev = map.get(id);
    map.set(id, { productId: id, quantity: (prev?.quantity || 0) + q, unitCost: cost ?? prev?.unitCost ?? null });
    if (map.size > max) break;
  }
  return [...map.values()];
}

/** Coût moyen pondéré après l'entrée (le stock négatif compte pour 0). */
export function newAverageCost(stockBefore: number, avgBefore: number, qty: number, unitCost: number) {
  const before = Math.max(0, stockBefore);
  const after = before + qty;
  return after > 0 ? r3((before * avgBefore + qty * unitCost) / after) : r3(unitCost);
}

/** Code scanné ou tapé : on retrouve le produit par code-barres ou SKU (espaces et casse ignorés). */
export function findByCode<T extends { barcode?: string | null; sku: string }>(items: T[], raw: string): T | undefined {
  const v = String(raw || '').toUpperCase().replace(/\s+/g, '');
  if (!v) return undefined;
  const norm = (s?: string | null) => String(s || '').toUpperCase().replace(/\s+/g, '');
  return items.find(i => norm(i.barcode) === v) || items.find(i => norm(i.sku) === v);
}
