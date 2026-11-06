/** Codes-barres du stock : nettoyage et contrôle (EAN-13 / EAN-8 / UPC-A vérifiés, autres formats acceptés tels quels). */

/** Retire espaces et caractères parasites ajoutés par certaines douchettes ; null si vide. */
export function normalizeBarcode(raw: unknown): string | null {
  const v = String(raw ?? '').trim().replace(/\s+/g, '').replace(/[^0-9A-Za-z\-_.]/g, '').slice(0, 64);
  return v ? v.toUpperCase() : null;
}

/** Clé de contrôle GS1 (EAN-8, UPC-A, EAN-13, GTIN-14). Renvoie null si ce n'est pas un code GS1 numérique. */
export function gs1Valid(code: string): boolean | null {
  if (!/^\d+$/.test(code) || ![8, 12, 13, 14].includes(code.length)) return null;
  const digits = code.split('').map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((a, d, i) => a + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** Article dont la référence ou le code-barres correspond exactement à ce que la douchette a lu. */
export function matchScan<T extends { sku: string; barcode?: string | null }>(items: T[], scanned: string): T | undefined {
  const code = normalizeBarcode(scanned); if (!code) return undefined;
  return items.find(i => (i.barcode && i.barcode.toUpperCase() === code)) || items.find(i => i.sku.toUpperCase() === code);
}

/** Message si le code-barres est déjà porté par un autre article de la boutique (unicité vérifiée par l'API). */
export async function barcodeTaken(tx: { inventoryItem: { findFirst: (a: any) => Promise<any> } }, shopId: string, barcode: string | null | undefined, exceptId?: string) {
  if (!barcode) return null;
  const other = await tx.inventoryItem.findFirst({ where: { shopId, barcode: { equals: barcode, mode: 'insensitive' }, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { name: true, sku: true } });
  return other ? `Code-barres déjà utilisé par « ${other.name} » (${other.sku})` : null;
}
