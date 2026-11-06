import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkSplits, maxDiscountFor, mergeLines, priceSale, saleNumber } from '../src/lib/counter-sale';

const items = [
  { id: 'coque', name: 'Coque A54', quantity: 5, salePrice: 15, purchasePrice: 4, active: true },
  { id: 'verre', name: 'Verre trempé', quantity: 40, salePrice: 5, purchasePrice: 0.8, active: true },
  { id: 'vide', name: 'Câble Lightning', quantity: 0, salePrice: 9, purchasePrice: 3, active: true },
  { id: 'off', name: 'Ancien article', quantity: 3, salePrice: 9, purchasePrice: 3, active: false },
  { id: 'gratuit', name: 'Sans prix', quantity: 3, salePrice: 0, purchasePrice: 1, active: true },
];
const methods = new Set(['CASH', 'CARD', 'D17']);

test('Vente comptoir : lignes fusionnées, quantités invalides ignorées', () => {
  assert.deepEqual(mergeLines([{ itemId: 'a', quantity: 1 }, { itemId: 'a', quantity: 2 }, { itemId: 'b', quantity: 0 }, { itemId: '', quantity: 3 }, { itemId: 'c', quantity: -1 }]), [{ itemId: 'a', quantity: 3 }]);
});

test('Vente comptoir : prix du stock, sous-total, remise bornée', () => {
  const r = priceSale([{ itemId: 'coque', quantity: 2 }, { itemId: 'verre', quantity: 1 }], items, 1);
  assert.equal(r.subtotal, 35); assert.equal(r.discount, 1); assert.equal(r.total, 34);
  assert.equal(r.lines[0].unitCost, 4);
  assert.equal(priceSale([{ itemId: 'verre', quantity: 1 }], items, 99).total, 0, 'remise jamais supérieure au sous-total');
});

test('Vente comptoir : refus clairs (stock, article désactivé, sans prix, panier vide)', () => {
  assert.throws(() => priceSale([{ itemId: 'vide', quantity: 1 }], items), /Stock insuffisant : Câble Lightning/);
  assert.throws(() => priceSale([{ itemId: 'coque', quantity: 6 }], items), /5 disponibles/);
  assert.throws(() => priceSale([{ itemId: 'off', quantity: 1 }], items), /introuvable ou désactivé/);
  assert.throws(() => priceSale([{ itemId: 'gratuit', quantity: 1 }], items), /Prix de vente manquant/);
  assert.throws(() => priceSale([], items), /au moins un article/);
});

test('Vente comptoir : paiement égal au total, espèces reçues suffisantes', () => {
  assert.equal(checkSplits([{ method: 'CASH', amount: 34, receivedAmount: 40 }], 34, methods), 34);
  assert.equal(checkSplits([{ method: 'CASH', amount: 20 }, { method: 'CARD', amount: 14 }], 34, methods), 34);
  assert.throws(() => checkSplits([{ method: 'CARD', amount: 30 }], 34, methods), /égal au total/);
  assert.throws(() => checkSplits([{ method: 'CASH', amount: 34, receivedAmount: 30 }], 34, methods), /reçu inférieur/);
  assert.throws(() => checkSplits([{ method: 'BITCOIN', amount: 34 }], 34, methods), /Mode de paiement invalide/);
  assert.throws(() => checkSplits([], 34, methods), /mode de paiement/);
});

test('Vente comptoir : numéro lisible et plafond de remise caissier', () => {
  assert.equal(saleNumber(42), 'V-000042');
  assert.equal(maxDiscountFor('ADMIN', 5, 120), 120);
  assert.equal(maxDiscountFor('CASHIER', 5, 120), 5);
  assert.equal(maxDiscountFor('CASHIER', 500, 120), 120);
});

test('Vente comptoir : schéma, API transactionnelle, caisse et listes de paiements', () => {
  const schema = readFileSync('prisma/schema.prisma', 'utf8');
  assert.match(schema, /model CounterSale \{/);
  assert.match(schema, /repairId\s+String\?\n\s+repair\s+Repair\?/);
  assert.match(schema, /counterSaleId\s+String\?/);
  assert.match(schema, /enum StockMovementType \{[^}]*SALE/);
  const api = readFileSync('src/app/api/counter-sales/route.ts', 'utf8');
  for (const k of ['requireSession([UserRole.ADMIN, UserRole.CASHIER])', 'Serializable', 'quantity: { gte: l.quantity }', 'StockMovementType.SALE', 'counterSaleId: sale.id', 'cashSessionId: session?.id', 'cashRequireSession', 'maxDiscountFor(']) assert.ok(api.includes(k), k);
  const page = readFileSync('src/app/(app)/app/cashier/page.tsx', 'utf8');
  assert.ok(page.includes('<CounterSalePanel />') && page.includes("mode') === 'comptoir'"));
  assert.ok(readFileSync('src/app/api/payments/overview/route.ts', 'utf8').includes("source:'COUNTER'"));
  assert.ok(readFileSync('src/app/(app)/app/cashier/pro/page.tsx', 'utf8').includes('p.counterSale?.number'));
  assert.ok(readFileSync('src/app/receipt/vente/[number]/page.tsx', 'utf8').includes('prisma.counterSale.findFirst'));
  assert.ok(readFileSync('src/app/layout.tsx', 'utf8').includes("import './fixi-max-comptoir.css'"));
});

import { priceRefund, refundState } from '../src/lib/counter-sale';
const sold = [
  { id: 'l1', name: 'Coque A54', quantity: 3, returnedQuantity: 0, unitPrice: 15 },
  { id: 'l2', name: 'Verre trempé', quantity: 2, returnedQuantity: 0, unitPrice: 5 },
];

test('Remboursement comptoir : remise déduite au prorata, solde exact au dernier retour', () => {
  const sale = { subtotal: 55, total: 49.5, refundedTotal: 0 };
  const a = priceRefund(sale, sold, [{ lineId: 'l1', quantity: 1, restock: false }]);
  assert.equal(a.amount, 13.5); assert.equal(a.lines[0].restock, false);
  const after = sold.map(l => l.id === 'l1' ? { ...l, returnedQuantity: 1 } : l);
  const b = priceRefund({ ...sale, refundedTotal: 13.5 }, after, [{ lineId: 'l1', quantity: 2 }, { lineId: 'l2', quantity: 2 }]);
  assert.equal(b.amount, 36); assert.equal(b.remaining, 0); assert.equal(b.lines[0].restock, true, 'remis en stock par défaut');
  const odd = priceRefund({ subtotal: 83, total: 80, refundedTotal: 0 }, [{ id: 'x', name: 'Coque', quantity: 2, returnedQuantity: 0, unitPrice: 29 }, { id: 'y', name: 'Chargeur', quantity: 1, returnedQuantity: 0, unitPrice: 25 }], [{ lineId: 'x', quantity: 1 }]);
  assert.equal(odd.amount, 27.952);
});

test('Remboursement comptoir : jamais plus que vendu, ni deux fois', () => {
  const sale = { subtotal: 55, total: 55, refundedTotal: 0 };
  assert.throws(() => priceRefund(sale, sold, [{ lineId: 'l1', quantity: 4 }]), /3 articles remboursables au maximum/);
  assert.throws(() => priceRefund(sale, sold, []), /au moins un article/);
  assert.throws(() => priceRefund(sale, sold, [{ lineId: 'zz', quantity: 1 }]), /introuvable/);
  const all = sold.map(l => ({ ...l, returnedQuantity: l.quantity }));
  assert.throws(() => priceRefund({ ...sale, refundedTotal: 55 }, all, [{ lineId: 'l1', quantity: 1 }]), /déjà entièrement remboursée/);
  assert.equal(refundState(55, 0), 'NONE'); assert.equal(refundState(55, 13.5), 'PARTIAL'); assert.equal(refundState(55, 55), 'FULL');
});

test('Remboursement comptoir : API sécurisée (motif, code gérant pour le caissier, garde-fous concurrents)', () => {
  const api = readFileSync('src/app/api/counter-sales/[id]/refund/route.ts', 'utf8');
  for (const k of ['Indiquez le motif', 'Code du gérant requis', "bcrypt.compare(pin, m.pinHash)", 'returnedQuantity: { lte: line.quantity - l.quantity }', 'refundedTotal: { lte:', 'kind: PaymentKind.REFUND', 'StockMovementType.RETURN', 'Serializable', 'cashRequireSession']) assert.ok(api.includes(k), k);
  assert.match(readFileSync('prisma/schema.prisma', 'utf8'), /returnedQuantity\s+Int\s+@default\(0\)/);
  const ui = readFileSync('src/components/counter-refund.tsx', 'utf8');
  assert.ok(ui.includes('Remettre en stock') && ui.includes('Code du gérant') && ui.includes("r !== 'Article défectueux'"));
  assert.ok(readFileSync('src/app/receipt/vente/[number]/page.tsx', 'utf8').includes('Net payé'));
});
