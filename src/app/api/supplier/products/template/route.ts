import ExcelJS from 'exceljs';
import { requireSupplierSession } from '@/lib/supplier-auth';
import { bad } from '@/lib/http';

/** Modèle Excel à remplir : 5 colonnes, deux exemples. */
export async function GET() {
  try {
    await requireSupplierSession();
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Produits');
    ws.columns = [
      { header: 'Code-barres', key: 'barcode', width: 18 }, { header: 'Nom', key: 'name', width: 40 },
      { header: 'Prix', key: 'price', width: 12 }, { header: 'Stock', key: 'stock', width: 10 }, { header: 'Coût', key: 'cost', width: 12 },
    ];
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0782B' } };
    ws.addRow({ barcode: '', name: 'Écran iPhone 13 OLED', price: 185, stock: 4, cost: 140 });
    ws.addRow({ barcode: '', name: 'Batterie Samsung A12', price: 35, stock: 10, cost: 22 });
    const help = wb.addWorksheet('Aide');
    help.getColumn(1).width = 90;
    ['Seuls le nom et le prix sont obligatoires.', 'Le SKU, la catégorie, la marque et la qualité sont ajoutés automatiquement à partir du nom.', 'Si un code-barres existe déjà dans votre catalogue, le prix et le stock du produit sont mis à jour.', 'Supprimez les deux exemples avant l’import.'].forEach(t => help.addRow([t]));
    const buf = await wb.xlsx.writeBuffer();
    return new Response(buf as ArrayBuffer, { headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'content-disposition': 'attachment; filename="modele-produits-fixi.xlsx"' } });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
