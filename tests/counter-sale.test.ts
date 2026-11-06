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
