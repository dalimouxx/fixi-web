import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkRow, csvTable, guessProduct, nextSku, parseAmount, parsePasted, rowsFromTable, skuPrefix } from '../src/lib/product-quick';

test('devine catégorie, marque, qualité depuis le nom', () => {
  assert.deepEqual([guessProduct('Écran iPhone 13 OLED').category, guessProduct('Écran iPhone 13 OLED').brand, guessProduct('Écran iPhone 13 OLED').qualityGrade], ['Écrans', 'Apple', 'OLED']);
  assert.equal(guessProduct('Vitre arrière iPhone 14').category, 'Vitres arrière');
  assert.equal(guessProduct('Batterie Redmi Note 10').brand, 'Xiaomi');
  assert.equal(guessProduct('Power bank 10000 mAh').category, 'Chargeurs & câbles');
  assert.equal(guessProduct('Truc inconnu').category, null);
});
test('SKU automatique lisible et incrémental', () => {
  const g = guessProduct('Batterie Samsung A12');
  assert.equal(skuPrefix(g), 'BAT-SAM');
  assert.equal(nextSku('BAT-SAM', ['BAT-SAM-0001', 'BAT-SAM-0009', 'X-1']), 'BAT-SAM-0010');
  assert.equal(nextSku('ART', []), 'ART-0001');
});
test('montants tunisiens', () => {
  assert.equal(parseAmount('12,5'), 12.5);
  assert.equal(parseAmount('185 DT'), 185);
  assert.ok(Number.isNaN(parseAmount('')));
  assert.ok(Number.isNaN(parseAmount('abc')));
});
test('validation d’une ligne', () => {
  assert.equal(checkRow({ name: 'Batterie A12', price: '35' }), null);
  assert.equal(checkRow({ name: 'B', price: '35' }), 'Nom manquant');
  assert.equal(checkRow({ name: 'Batterie A12', price: '' }), 'Prix de vente manquant');
  assert.equal(checkRow({ name: 'Batterie A12', price: '3', stock: '-1' }), 'Stock invalide');
});
test('coller depuis Excel', () => {
  const r = parsePasted('6191234567\tÉcran A54\t120\t3\t90\nBatterie A12\t35\t10');
  assert.equal(r[0].barcode, '6191234567'); assert.equal(r[0].name, 'Écran A54'); assert.equal(r[0].purchasePrice, '90');
  assert.equal(r[1].barcode, ''); assert.equal(r[1].name, 'Batterie A12'); assert.equal(r[1].stock, '10');
});
test('en-têtes Excel/CSV reconnus', () => {
  const t = csvTable('Code-barres;Désignation;Prix de vente;Qté\n619;Écran A54;120;3\n');
  const { rows, missing } = rowsFromTable(t);
  assert.deepEqual(missing, []);
  assert.equal(rows[0].name, 'Écran A54'); assert.equal(rows[0].stock, '3');
  assert.deepEqual(rowsFromTable([['Foo', 'Bar']]).missing, ['Nom', 'Prix']);
});
test('serveur : SKU facultatif, suggestion réseau sans prix', () => {
  const r = readFileSync('src/app/api/supplier/products/route.ts', 'utf8');
  assert.ok(r.includes('autoSku(') && !r.includes("if(!b.sku||"));
  const q = readFileSync('src/lib/supplier-product-quick.ts', 'utf8');
  const sel = q.slice(q.indexOf('networkSuggestion'), q.indexOf('take: 20'));
  assert.ok(!/price|stock|companyId: true/.test(sel.split('select:')[1] || ''));
});
test('caisse Windows : création réservée au gérant / stock', () => {
  const c = readFileSync('apps/windows-pos/src/CaisseV4.tsx', 'utf8');
  assert.match(c, /canCreateProduct=\['OWNER','ADMIN','MANAGER','STOCK','DEMO'\]/);
  assert.ok(readFileSync('apps/windows-pos/src-tauri/src/lib.rs', 'utf8').includes('supplier_create_product'));
});
