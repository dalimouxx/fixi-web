import { prisma } from './prisma';
import { requireSupplierCreationCapacity } from './supplier-saas';
import { checkRow, guessProduct, nextSku, parseAmount, skuPrefix, type QuickRow } from './product-quick';

/** Rôles qui peuvent créer des produits (web, caisse Windows). */
export const PRODUCT_EDITORS = ['OWNER', 'ADMIN', 'MANAGER', 'STOCK'] as const;

/** SKU automatique unique dans la société (ECR-APL-0001…). */
export async function autoSku(companyId: string, name: string, category?: string | null) {
  const g = guessProduct(`${category || ''} ${name}`);
  const prefix = skuPrefix(g);
  const rows = await prisma.supplierProduct.findMany({ where: { companyId, sku: { startsWith: prefix + '-' } }, select: { sku: true } });
  return nextSku(prefix, rows.map(r => r.sku));
}

/** Champs déduits quand le fournisseur ne les a pas remplis. */
export function fillGuesses<T extends { name: string; category?: string | null; brand?: string | null; qualityGrade?: string | null }>(b: T) {
  const g = guessProduct(b.name);
  return {
    category: String(b.category || '').trim() || g.category,
    brand: String(b.brand || '').trim() || g.brand,
    qualityGrade: String(b.qualityGrade || '').trim() || g.qualityGrade,
  };
}

export type QuickResult = { line: number; status: 'created' | 'updated' | 'error'; id?: string; sku?: string; name?: string; error?: string };

/**
 * Enregistre une liste de lignes simples (saisie en série, import Excel) :
 * même code-barres ou même SKU qu'un produit existant → mise à jour du prix/stock ; sinon création avec SKU automatique.
 */
export async function saveQuickRows(companyId: string, accountId: string, rows: QuickRow[], source: string) {
  const out: QuickResult[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i], line = i + 1, err = checkRow(r);
    if (err) { out.push({ line, status: 'error', name: r.name, error: err }); continue; }
    const name = String(r.name).trim(), barcode = String(r.barcode || '').trim() || null, price = parseAmount(r.price);
    const stock = String(r.stock ?? '').trim() ? Math.trunc(Number(r.stock)) : null;
    const pp = parseAmount(r.purchasePrice), sku = String(r.sku || '').trim().toUpperCase() || null;
    try {
      const existing = (barcode || sku) ? await prisma.supplierProduct.findFirst({ where: { companyId, OR: [...(barcode ? [{ barcode }] : []), ...(sku ? [{ sku }] : [])] } }) : null;
      if (existing) {
        const x = await prisma.supplierProduct.update({ where: { id: existing.id }, data: { name, price, retailPrice: price, ...(stock !== null ? { stock } : {}), ...(Number.isFinite(pp) ? { purchasePrice: pp } : {}) } });
        out.push({ line, status: 'updated', id: x.id, sku: x.sku, name });
        continue;
      }
      await requireSupplierCreationCapacity(companyId, 'PRODUCT');
      const g = fillGuesses({ name, category: r.category, brand: r.brand, qualityGrade: r.qualityGrade });
      const cost = Number.isFinite(pp) ? pp : 0;
      const x = await prisma.supplierProduct.create({ data: {
        companyId, sku: sku || await autoSku(companyId, name, g.category), barcode, name, ...g,
        price, retailPrice: price, purchasePrice: cost, averageCost: cost, stock: stock ?? 0, reservedStock: 0, minOrderQty: 1, active: true,
      } });
      out.push({ line, status: 'created', id: x.id, sku: x.sku, name });
    } catch (e: any) {
      out.push({ line, status: 'error', name, error: e?.code === 'P2002' ? 'Code déjà utilisé' : (e?.message || 'Erreur') });
    }
  }
  const created = out.filter(x => x.status === 'created').length, updated = out.filter(x => x.status === 'updated').length;
  await prisma.supplierAuditEvent.create({ data: { companyId, accountId, action: 'BULK_CREATE', entity: 'PRODUCT', metadata: { source, created, updated, errors: out.length - created - updated } } }).catch(() => {});
  return { created, updated, errors: out.filter(x => x.status === 'error'), results: out };
}

/**
 * Suggestion depuis le réseau Fixi pour un code-barres inconnu : uniquement le nom, la catégorie, la marque,
 * la qualité et la photo (jamais les prix, les stocks ni le nom du fournisseur).
 */
export async function networkSuggestion(companyId: string, barcode: string) {
  const rows = await prisma.supplierProduct.findMany({
    where: { barcode, active: true, companyId: { not: companyId }, company: { active: true } },
    select: { name: true, category: true, brand: true, qualityGrade: true, imageUrl: true }, take: 20, orderBy: { updatedAt: 'desc' },
  });
  if (!rows.length) return null;
  const votes = new Map<string, number>();
  for (const r of rows) votes.set(r.name.trim(), (votes.get(r.name.trim()) || 0) + 1);
  const name = [...votes.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const best = rows.find(r => r.name.trim() === name)!;
  return { name, category: best.category, brand: best.brand, qualityGrade: best.qualityGrade, imageUrl: rows.find(r => r.imageUrl)?.imageUrl || null, sources: rows.length };
}
