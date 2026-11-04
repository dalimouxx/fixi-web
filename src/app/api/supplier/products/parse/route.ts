import ExcelJS from 'exceljs';
import { requireSupplierRole } from '@/lib/supplier-auth';
import { bad, ok } from '@/lib/http';
import { PRODUCT_EDITORS } from '@/lib/supplier-product-quick';
import { checkRow, csvTable, rowsFromTable } from '@/lib/product-quick';

const cell = (v: any): string => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') { if ('result' in v) return cell(v.result); if ('text' in v) return String(v.text); if (Array.isArray(v.richText)) return v.richText.map((x: any) => x.text).join(''); if (v instanceof Date) return v.toISOString().slice(0, 10); }
  return String(v);
};

/** Lit un fichier Excel (.xlsx) ou CSV et renvoie les lignes à vérifier, sans rien enregistrer. */
export async function POST(req: Request) {
  try {
    await requireSupplierRole(PRODUCT_EDITORS);
    const fd = await req.formData(), file = fd.get('file');
    if (!(file instanceof File)) return bad('Fichier requis');
    if (file.size > 5 * 1024 * 1024) return bad('Fichier trop volumineux (5 Mo maximum)');
    let table: string[][] = [];
    if (/\.xlsx$/i.test(file.name)) {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(Buffer.from(await file.arrayBuffer()) as any);
      const ws = wb.worksheets.find(w => w.actualRowCount > 0);
      if (!ws) return bad('Feuille Excel vide');
      ws.eachRow({ includeEmpty: false }, row => { const vals = (row.values as any[]).slice(1); table.push(vals.map(cell)); });
    } else if (/\.(csv|txt)$/i.test(file.name)) table = csvTable(await file.text());
    else return bad('Format accepté : Excel (.xlsx) ou CSV');
    const { rows, missing } = rowsFromTable(table);
    if (missing.length) return bad(`Colonnes introuvables : ${missing.join(', ')}. Utilisez le modèle Fixi.`);
    if (!rows.length) return bad('Aucune ligne de produit dans le fichier');
    if (rows.length > 2000) return bad('2000 lignes maximum par fichier');
    return ok({ rows, invalid: rows.filter(r => checkRow(r)).length });
  } catch (e: any) { return bad(e.message || 'Fichier illisible', e.status || 500); }
}
