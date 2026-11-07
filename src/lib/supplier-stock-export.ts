import ExcelJS from 'exceljs';

/**
 * Export Excel du stock fournisseur.
 * Les 9 premières colonnes reprennent exactement celles du modèle d'import :
 * le fichier peut être modifié puis ré-importé (mise à jour par code-barres).
 */
export const STOCK_EXPORT_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'STOCK', 'ACCOUNTANT'] as const;

export type ExportProduct = {
  sku: string; barcode: string | null; name: string; brand: string | null; category: string | null; qualityGrade: string | null;
  price: unknown; retailPrice: unknown; wholesalePrice: unknown; minimumPrice: unknown; purchasePrice: unknown; averageCost: unknown;
  taxRate: unknown; stock: number; reservedStock: number; minStock: number; maxStock: number | null; location: string | null;
  warrantyDays: number; active: boolean; updatedAt: Date;
};

const n3 = (v: unknown) => Math.round((Number(v) || 0) * 1000) / 1000;
const MONEY = '#,##0.000';

export function stockRow(p: ExportProduct) {
  const cost = n3(p.averageCost) || n3(p.purchasePrice);
  const available = Math.max(0, (p.stock || 0) - (p.reservedStock || 0));
  const sale = n3(p.retailPrice ?? p.price) || n3(p.price);
  return {
    barcode: p.barcode || '', name: p.name, price: sale, stock: p.stock || 0, cost, sku: p.sku,
    category: p.category || '', brand: p.brand || '', quality: p.qualityGrade || '',
    wholesale: p.wholesalePrice == null ? null : n3(p.wholesalePrice), minimum: p.minimumPrice == null ? null : n3(p.minimumPrice),
    reserved: p.reservedStock || 0, available, minStock: p.minStock || 0, location: p.location || '',
    warranty: p.warrantyDays || 0, tax: n3(p.taxRate), active: p.active ? 'Oui' : 'Non',
    costValue: n3(cost * (p.stock || 0)), saleValue: n3(sale * (p.stock || 0)),
    low: p.active && available <= (p.minStock || 0), updated: p.updatedAt,
  };
}

export function stockSummary(rows: ReturnType<typeof stockRow>[]) {
  const active = rows.filter(r => r.active === 'Oui');
  return {
    products: rows.length, active: active.length,
    units: active.reduce((a, r) => a + r.stock, 0),
    costValue: n3(active.reduce((a, r) => a + r.costValue, 0)),
    saleValue: n3(active.reduce((a, r) => a + r.saleValue, 0)),
    low: rows.filter(r => r.low).length, out: active.filter(r => r.available <= 0).length,
  };
}

function header(ws: ExcelJS.Worksheet) {
  const h = ws.getRow(1);
  h.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0782B' } };
  h.alignment = { vertical: 'middle' }; h.height = 22;
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

export async function buildStockWorkbook(company: { name: string }, products: ExportProduct[], at = new Date()) {
  const rows = products.map(stockRow);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Fixi'; wb.created = at;
  const ws = wb.addWorksheet('Stock');
  ws.columns = [
    { header: 'Code-barres', key: 'barcode', width: 17 }, { header: 'Nom', key: 'name', width: 42 },
    { header: 'Prix', key: 'price', width: 12, style: { numFmt: MONEY } }, { header: 'Stock', key: 'stock', width: 9 },
    { header: 'Coût', key: 'cost', width: 12, style: { numFmt: MONEY } }, { header: 'SKU', key: 'sku', width: 16 },
    { header: 'Catégorie', key: 'category', width: 18 }, { header: 'Marque', key: 'brand', width: 14 }, { header: 'Qualité', key: 'quality', width: 12 },
    { header: 'Prix grossiste', key: 'wholesale', width: 14, style: { numFmt: MONEY } }, { header: 'Prix minimum', key: 'minimum', width: 13, style: { numFmt: MONEY } },
    { header: 'Réservé', key: 'reserved', width: 9 }, { header: 'Disponible', key: 'available', width: 11 }, { header: 'Stock min.', key: 'minStock', width: 10 },
    { header: 'Emplacement', key: 'location', width: 14 }, { header: 'Garantie (jours)', key: 'warranty', width: 15 }, { header: 'TVA %', key: 'tax', width: 8 },
    { header: 'Actif', key: 'active', width: 7 }, { header: 'Valeur au coût', key: 'costValue', width: 15, style: { numFmt: MONEY } },
    { header: 'Valeur de vente', key: 'saleValue', width: 15, style: { numFmt: MONEY } },
    { header: 'Modifié le', key: 'updated', width: 17, style: { numFmt: 'dd/mm/yyyy hh:mm' } },
  ];
  header(ws);
  for (const r of rows) {
    const row = ws.addRow(r);
    if (r.low) row.getCell('available').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE2D2' } };
    if (r.active === 'Non') row.font = { color: { argb: 'FF8A8A8A' } };
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columns.length } };

  const low = wb.addWorksheet('À réapprovisionner');
  low.columns = [
    { header: 'Code-barres', key: 'barcode', width: 17 }, { header: 'Nom', key: 'name', width: 42 }, { header: 'SKU', key: 'sku', width: 16 },
    { header: 'Disponible', key: 'available', width: 11 }, { header: 'Stock min.', key: 'minStock', width: 10 },
    { header: 'Coût', key: 'cost', width: 12, style: { numFmt: MONEY } }, { header: 'Emplacement', key: 'location', width: 14 },
  ];
  header(low);
  rows.filter(r => r.low).sort((a, b) => a.available - b.available).forEach(r => low.addRow(r));

  const s = stockSummary(rows);
  const sum = wb.addWorksheet('Résumé');
  sum.getColumn(1).width = 34; sum.getColumn(2).width = 22;
  sum.addRow([`Stock ${company.name}`]).font = { bold: true, size: 14 };
  sum.addRow([`Exporté le ${at.toLocaleString('fr-FR', { timeZone: 'Africa/Tunis' })}`]);
  sum.addRow([]);
  ([
    ['Produits (tous)', s.products], ['Produits actifs', s.active], ['Unités en stock', s.units],
    ['Valeur au coût (DT)', s.costValue], ['Valeur de vente (DT)', s.saleValue],
    ['Produits à réapprovisionner', s.low], ['Produits en rupture', s.out],
  ] as [string, number][]).forEach(([k, v]) => { const r = sum.addRow([k, v]); r.getCell(1).font = { bold: true }; if (k.includes('DT')) r.getCell(2).numFmt = MONEY; });
  sum.addRow([]);
  sum.addRow(['Astuce : modifiez les prix ou le stock dans la feuille « Stock » puis ré-importez le fichier (Produits → Importer) : les produits sont mis à jour par code-barres ou SKU.']).font = { italic: true, color: { argb: 'FF666666' } };

  return { buffer: await wb.xlsx.writeBuffer(), summary: s };
}

export function exportFileName(slugOrName: string, at = new Date()) {
  const safe = String(slugOrName || 'fournisseur').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'fournisseur';
  return `stock-${safe}-${at.toISOString().slice(0, 10)}.xlsx`;
}
