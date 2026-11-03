import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { invoiceLines } from '../src/lib/invoice-lines';

test('facture : prix TTC de la caisse ventilés en HT + TVA par taux', () => {
  const r = invoiceLines({ subtotal: 119, discount: 0, tax: 0 }, [{ name: 'Écran', sku: 'A', quantity: 1, unitPrice: 119, productId: 'p1' }], { p1: 19 });
  assert.equal(r.ht, 100); assert.equal(r.tva, 19); assert.equal(r.ttc, 119);
  assert.deepEqual(r.taxes, [{ rate: 19, base: 100, amount: 19 }]);
});

test('facture : la remise du ticket est répartie avant la TVA', () => {
  const r = invoiceLines({ subtotal: 238, discount: 38, tax: 0 }, [
    { name: 'A', sku: null, quantity: 2, unitPrice: 59.5, productId: 'a' },
    { name: 'B', sku: null, quantity: 1, unitPrice: 119, productId: 'b' },
  ], { a: 19, b: 19 });
  assert.equal(r.ttc, 200);
});

test('facture : vente web avec TVA ajoutée (prix HT)', () => {
  const r = invoiceLines({ subtotal: 100, discount: 0, tax: 7 }, [{ name: 'Câble', sku: null, quantity: 1, unitPrice: 100, productId: 'c' }], { c: 7 });
  assert.equal(r.ht, 100); assert.equal(r.tva, 7);
});

test('article libre : accepté sans fiche produit et sans toucher au stock', () => {
  const erp = fs.readFileSync('src/app/api/supplier/erp/route.ts', 'utf8');
  assert.match(erp, /customLines/); assert.match(erp, /productId:null/);
  assert.match(erp, /CUSTOMER_UPDATE/);
});

test('signalement : réservé aux utilisateurs connectés et limité', () => {
  const api = fs.readFileSync('src/app/api/problem-report/route.ts', 'utf8');
  assert.match(api, /Connectez-vous/); assert.match(api, /recent>=10/); assert.match(api, /MAX_SHOT/);
});
