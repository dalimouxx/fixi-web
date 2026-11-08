import test from 'node:test';
import assert from 'node:assert/strict';
import { computeLineReport, consignmentBalance, shareByLine, OWN } from '../src/lib/supplier-lines';
import { rowsFromTable } from '../src/lib/product-quick';

// Produits : p-sl (mes produits), p-mg (ligne MG)
const lineOf = (pid: string | null, _saleId?: string) => (pid === 'p-mg' ? 'MG' : OWN);
const d = (s: string) => new Date(s);

test('un panier mélangé SL + MG est séparé automatiquement au prorata des articles', () => {
  const sh = shareByLine([
    { saleId: 'v1', productId: 'p-sl', quantity: 1, unitPrice: 60, unitCost: 40, discount: 0 },
    { saleId: 'v1', productId: 'p-mg', quantity: 2, unitPrice: 20, unitCost: 15, discount: 0 },
  ], lineOf).get('v1')!;
  assert.equal(sh.get(OWN)!.share, 0.6);
  assert.equal(sh.get('MG')!.share, 0.4);
  assert.equal(sh.get('MG')!.cost, 30);
});

const base = {
  sales: [
    { id: 'v1', customerId: 'c1', total: 90, paid: 50, createdAt: d('2026-11-08T09:00:00+01:00') }, // remise 10 sur 100 ; reste 40
    { id: 'v2', customerId: null, total: 25, paid: 25, createdAt: d('2026-11-07T18:00:00+01:00') }, // MG seul
  ],
  items: [
    { saleId: 'v1', productId: 'p-sl', quantity: 1, unitPrice: 60, unitCost: 40, discount: 0 },
    { saleId: 'v1', productId: 'p-mg', quantity: 2, unitPrice: 20, unitCost: 15, discount: 0 },
    { saleId: 'v2', productId: 'p-mg', quantity: 1, unitPrice: 25, unitCost: 15, discount: 0 },
  ],
  payments: [
    { saleId: 'v1', amount: 50, createdAt: d('2026-11-08T09:00:00+01:00') },
    { saleId: 'v2', amount: 25, createdAt: d('2026-11-07T18:00:00+01:00') },
  ],
  lineOf, customerName: (id: string | null) => (id === 'c1' ? 'Atelier Ali' : 'Client comptoir'),
};

test('ligne MG : ventes, bénéfice, encaissé, dû client et rapport par jour', () => {
  const r = computeLineReport({ ...base, line: 'MG', dueSales: [base.sales[0]] });
  assert.equal(r.totals.sales, 61);       // 90 × 0,4 + 25
  assert.equal(r.totals.cost, 45);        // 30 + 15
  assert.equal(r.totals.profit, 16);
  assert.equal(r.totals.collected, 45);   // 50 × 0,4 + 25
  assert.equal(r.totals.due, 16);         // reste 40 × 0,4
  assert.deepEqual(r.customers, [{ id: 'c1', name: 'Atelier Ali', due: 16 }]);
  assert.deepEqual(r.days.map(x => x.date), ['2026-11-08', '2026-11-07']);
  assert.equal(r.days[1].sales, 25);
});

test('mes produits et « tout » : la somme des lignes donne le total', () => {
  const own = computeLineReport({ ...base, line: OWN, dueSales: [base.sales[0]] });
  const all = computeLineReport({ ...base, line: null, dueSales: [base.sales[0]] });
  const mg = computeLineReport({ ...base, line: 'MG', dueSales: [base.sales[0]] });
  assert.equal(own.totals.sales, 54);
  assert.equal(all.totals.sales, 115);
  assert.equal(Math.round((own.totals.sales + mg.totals.sales) * 1000) / 1000, all.totals.sales);
  assert.equal(Math.round((own.totals.due + mg.totals.due) * 1000) / 1000, all.totals.due);
  assert.equal(all.totals.collected, 75);
});

test('un règlement de dette sans vente liée reste dans « mes produits »', () => {
  const p = [{ saleId: null, amount: 30, createdAt: d('2026-11-08T10:00:00+01:00') }];
  assert.equal(computeLineReport({ ...base, payments: p, line: 'MG', dueSales: [] }).totals.collected, 0);
  assert.equal(computeLineReport({ ...base, payments: p, line: OWN, dueSales: [] }).totals.collected, 30);
});

test('dépôt-vente : ce que je dois à MG = coût vendu − paiements versés', () => {
  assert.deepEqual(consignmentBalance(45, 30), { soldCost: 45, paid: 30, owed: 15 });
});

test('le modèle Excel reconnaît la colonne « Ligne »', () => {
  const { rows } = rowsFromTable([['Code-barres', 'Nom', 'Prix', 'Stock', 'Coût', 'Ligne'], ['6971234567890', 'Afficheur A04', '60', '20', '45', 'MG']]);
  assert.equal(rows[0].line, 'MG');
  assert.equal(rows[0].barcode, '6971234567890');
});
