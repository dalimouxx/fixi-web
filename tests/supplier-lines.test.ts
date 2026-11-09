import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanCommissions, computeLineReport, consignmentBalance, owedPerUnit, shareByLine, OWN } from '../src/lib/supplier-lines';
import { rowsFromTable } from '../src/lib/product-quick';

// Produits : p-sl (mes produits, « SL »), p-mg (ligne MG, catégorie Écrans)
const lineOf = (pid: string | null, _saleId?: string) => (pid === 'p-mg' ? 'MG' : OWN);
const d = (s: string) => new Date(s);

test('un panier mélangé SL + MG est séparé automatiquement au prorata des articles', () => {
  const sh = shareByLine([
    { saleId: 'v1', productId: 'p-sl', quantity: 1, unitPrice: 60, unitCost: 40, discount: 0 },
    { saleId: 'v1', productId: 'p-mg', quantity: 2, unitPrice: 20, unitCost: 15, discount: 0 },
  ], lineOf).get('v1')!;
  assert.equal(sh.get(OWN), 0.6);
  assert.equal(sh.get('MG'), 0.4);
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

test('ligne MG seule : ventes, pièces, encaissé, dû par client, rapport par jour — sans bénéfice prix − coût', () => {
  const r = computeLineReport({ ...base, line: 'MG', dueSales: [base.sales[0]] });
  assert.equal(r.totals.sales, 61);       // 90 × 0,4 + 25
  assert.equal(r.totals.units, 3);
  assert.equal(r.totals.collected, 45);   // 50 × 0,4 + 25
  assert.equal(r.totals.due, 16);         // reste 40 × 0,4
  assert.equal(r.totals.profit, 0, 'pas de barème : aucun bénéfice affiché');
  assert.deepEqual(r.customers, [{ id: 'c1', name: 'Atelier Ali', due: 16 }]);
  assert.deepEqual(r.days.map(x => x.date), ['2026-11-08', '2026-11-07']);
});

test('bénéfice MG = pièces vendues × barème de la catégorie (ex. afficheur 2 DT)', () => {
  const r = computeLineReport({ ...base, line: 'MG', dueSales: [], commissionOf: pid => (pid === 'p-mg' ? 2 : null) });
  assert.equal(r.totals.profit, 6); // 3 pièces × 2 DT
  assert.equal(r.days.find(x => x.date === '2026-11-07')!.profit, 2);
});

test('SL seule + MG seule = total', () => {
  const own = computeLineReport({ ...base, line: OWN, dueSales: [base.sales[0]] });
  const all = computeLineReport({ ...base, line: null, dueSales: [base.sales[0]] });
  const mg = computeLineReport({ ...base, line: 'MG', dueSales: [base.sales[0]] });
  assert.equal(own.totals.sales, 54);
  assert.equal(all.totals.sales, 115);
  assert.equal(Math.round((own.totals.sales + mg.totals.sales) * 1000) / 1000, all.totals.sales);
  assert.equal(Math.round((own.totals.due + mg.totals.due) * 1000) / 1000, all.totals.due);
  assert.equal(own.totals.units + mg.totals.units, all.totals.units);
});

test('un règlement de dette sans vente liée reste dans les produits du fournisseur', () => {
  const p = [{ saleId: null, amount: 30, createdAt: d('2026-11-08T10:00:00+01:00') }];
  assert.equal(computeLineReport({ ...base, payments: p, line: 'MG', dueSales: [] }).totals.collected, 0);
  assert.equal(computeLineReport({ ...base, payments: p, line: OWN, dueSales: [] }).totals.collected, 30);
});

test('dû à MG par pièce : prix − supplément passager − barème ; sans barème, prix convenu', () => {
  assert.equal(owedPerUnit(60, 0, 2, 45), 58);    // afficheur vendu 60, bénéfice 2 → 58 pour MG
  assert.equal(owedPerUnit(85, 25, 2, 45), 58);   // supplément passager : il reste au fournisseur
  assert.equal(owedPerUnit(60, 0, null, 45), 45); // pas de barème : prix convenu
  assert.equal(owedPerUnit(1, 0, 5, 45), 0, 'jamais négatif');
});

test('dépôt-vente : dû = vendu − retours − paiements', () => {
  assert.deepEqual(consignmentBalance(116, 58, 30), { sold: 116, returned: 58, paid: 30, owed: 28 });
});

test('barème nettoyé : montants ≥ 0, catégories non vides, cases vides ignorées', () => {
  assert.deepEqual(cleanCommissions({ 'Écrans': '2', 'Batteries': '1,5', '': 3, 'Câbles': '', 'X': -1 }), { 'Écrans': 2, 'Batteries': 1.5 });
  assert.deepEqual(cleanCommissions(null), {});
});

test('le modèle Excel reconnaît la colonne « Ligne »', () => {
  const { rows } = rowsFromTable([['Code-barres', 'Nom', 'Prix', 'Stock', 'Coût', 'Ligne'], ['6971234567890', 'Afficheur A04', '60', '20', '45', 'MG']]);
  assert.equal(rows[0].line, 'MG');
});
