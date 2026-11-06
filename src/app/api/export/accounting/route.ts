import ExcelJS from 'exceljs';
import { requireSession } from '@/lib/auth';
import { bad } from '@/lib/http';
import { UserRole } from '@prisma/client';
import { monthlyData } from '@/lib/monthly-data';
import { monthLabel, previousMonth } from '@/lib/monthly-report';

export const runtime = 'nodejs';

const METHOD: Record<string, string> = { CASH: 'Espèces', CARD: 'Carte', BANK_TRANSFER: 'Virement', FLOUCI: 'Flouci', ONLINE: 'En ligne', D17: 'D17', OTHER: 'Autre' };

// Export pour le comptable : un fichier Excel par mois (encaissements, dépenses, factures et TVA, résumé).
export async function GET(req: Request) {
  try {
    const s = await requireSession([UserRole.ADMIN]);
    const m = new URL(req.url).searchParams.get('m') || previousMonth();
    const d = await monthlyData(s.shopId, m);
    const wb = new ExcelJS.Workbook(); wb.creator = 'Fixi'; wb.created = new Date();
    const money = '#,##0.000';
    const sheet = (name: string, cols: { header: string; key: string; width: number; money?: boolean; date?: boolean }[], rows: any[]) => {
      const ws = wb.addWorksheet(name);
      ws.columns = cols.map(c => ({ header: c.header, key: c.key, width: c.width, style: c.money ? { numFmt: money } : c.date ? { numFmt: 'dd/mm/yyyy' } : {} }));
      ws.getRow(1).font = { bold: true }; ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F4F7' } };
      ws.views = [{ state: 'frozen', ySplit: 1 }];
      rows.forEach(r => ws.addRow(r));
      return ws;
    };
    const sum = d.summary;
    const res = sheet('Résumé', [{ header: 'Rubrique', key: 'k', width: 34 }, { header: 'Montant', key: 'v', width: 18, money: true }], [
      { k: `Atelier : ${d.shop?.name || ''}${d.shop?.taxId ? ` (MF ${d.shop.taxId})` : ''}`, v: null },
      { k: `Mois : ${monthLabel(m)}`, v: null },
      { k: 'Encaissements nets', v: sum.revenue },
      ...Object.entries(sum.byMethod).map(([k, v]) => ({ k: `  dont ${METHOD[k] || k}`, v })),
      { k: 'Dépenses', v: sum.expenseTotal },
      { k: 'Coût des pièces (appareils rendus)', v: sum.partsCost },
      { k: 'Résultat estimé', v: sum.profit },
      { k: 'TVA facturée', v: sum.taxTotal },
    ]);
    res.getColumn(2).numFmt = money;
    sheet('Encaissements', [{ header: 'Date', key: 'date', width: 14, date: true }, { header: 'Réparation', key: 'code', width: 14 }, { header: 'Client', key: 'client', width: 24 }, { header: 'Appareil', key: 'device', width: 24 }, { header: 'Mode', key: 'method', width: 12 }, { header: 'Type', key: 'kind', width: 14 }, { header: 'Montant', key: 'amount', width: 14, money: true }, { header: 'Par', key: 'user', width: 18 }],
      d.payments.map(p => ({ date: p.createdAt, code: p.repair?.code || p.counterSale?.number, client: p.repair?.client?.fullName || p.counterSale?.client?.fullName || (p.counterSale ? 'Client comptoir' : undefined), device: p.counterSale ? 'Vente comptoir' : [p.repair?.brand, p.repair?.model].filter(Boolean).join(' '), method: METHOD[p.method] || p.method, kind: p.kind === 'REFUND' ? 'Remboursement' : 'Paiement', amount: (p.kind === 'REFUND' ? -1 : 1) * Number(p.amount), user: p.user?.fullName })));
    sheet('Dépenses', [{ header: 'Date', key: 'date', width: 14, date: true }, { header: 'Catégorie', key: 'cat', width: 18 }, { header: 'Libellé', key: 'label', width: 30 }, { header: 'Note', key: 'note', width: 30 }, { header: 'Montant', key: 'amount', width: 14, money: true }],
      d.expenses.map(e => ({ date: e.expenseDate, cat: e.category, label: e.label, note: e.note, amount: Number(e.amount) })));
    sheet('Factures & TVA', [{ header: 'Date', key: 'date', width: 14, date: true }, { header: 'Numéro', key: 'num', width: 16 }, { header: 'Type', key: 'type', width: 12 }, { header: 'Client', key: 'client', width: 24 }, { header: 'Montant HT', key: 'ht', width: 14, money: true }, { header: 'Taux TVA %', key: 'rate', width: 11 }, { header: 'TVA', key: 'tva', width: 14, money: true }, { header: 'Total TTC', key: 'ttc', width: 14, money: true }],
      d.documents.map(x => { const sign = x.type === 'CREDIT_NOTE' ? -1 : 1; return { date: x.issuedAt, num: x.number, type: x.type === 'CREDIT_NOTE' ? 'Avoir' : 'Facture', client: x.client?.fullName, ht: sign * (Number(x.subtotal) - Number(x.discount)), rate: Number(x.taxRate), tva: sign * Number(x.taxAmount), ttc: sign * Number(x.total) }; }));
    const buf = await wb.xlsx.writeBuffer();
    return new Response(buf as ArrayBuffer, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="fixi-comptable-${m}.xlsx"`, 'Cache-Control': 'no-store' } });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
