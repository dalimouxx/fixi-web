import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PART_TYPES, BRAND_MODELS, productName, compatDescription, suggestPrices, marginOf, variantPayload, variantIssues } from '../src/lib/supplier-guided';

test('Nom généré : type + modèle + qualité', () => {
  assert.equal(productName('Écran', 'iPhone 13', 'OLED'), 'Écran iPhone 13 OLED');
  assert.equal(productName('Batterie', ' Galaxy A54 ', ''), 'Batterie Galaxy A54');
});

test('Compatibilité listée sans doublon', () => {
  assert.equal(compatDescription(['iPhone 13', 'iPhone 13 Pro', 'iPhone 13']), 'Compatible : iPhone 13, iPhone 13 Pro');
  assert.equal(compatDescription(['']), '');
});

test('Prix conseillés : +30 % arrondi, gros −5 % jamais sous le coût', () => {
  assert.deepEqual(suggestPrices(110), { price: 143, wholesalePrice: 135.85 });
  assert.deepEqual(suggestPrices(0), { price: null, wholesalePrice: null });
  assert.equal(suggestPrices(100, 2, 10).wholesalePrice, 100);
  assert.equal(marginOf(110, 145), 24);
  assert.equal(marginOf(0, 10), null);
});

test('Corps envoyé à l’API produit', () => {
  const p = variantPayload({ typeLabel: 'Écran', brand: 'Apple', model: 'iPhone 13', compat: ['iPhone 13 Pro'], v: { quality: 'OLED', purchasePrice: '110', price: '145', wholesalePrice: '138', stock: '12', barcode: ' 123 ' }, warrantyDays: '90' });
  assert.equal(p.name, 'Écran iPhone 13 OLED');
  assert.equal(p.price, 145); assert.equal(p.purchasePrice, 110); assert.equal(p.wholesalePrice, 138); assert.equal(p.stock, 12);
  assert.equal(p.barcode, '123'); assert.equal(p.qualityGrade, 'OLED'); assert.equal(p.warrantyDays, 90);
  assert.equal(p.description, 'Compatible : iPhone 13, iPhone 13 Pro');
});

test('Contrôles : prix manquant et doublon bloquent, vente < coût avertit', () => {
  const v = { quality: 'OLED', purchasePrice: '110', price: '', wholesalePrice: '', stock: '' };
  assert.deepEqual(variantIssues(v, new Set(), 'X').blocking, ['prix de vente manquant']);
  assert.deepEqual(variantIssues({ ...v, price: '100' }, new Set(['écran iphone 13 oled']), 'Écran iPhone 13 OLED'), { blocking: ['existe déjà dans le catalogue'], warnings: ['vente inférieure au coût'] });
});

test('Catalogue : chaque type a des qualités, chaque marque des modèles', () => {
  assert.ok(PART_TYPES.every(t => t.qualities.length > 0));
  assert.ok(Object.values(BRAND_MODELS).every(m => m.length > 0));
});

test('Outil produit : mode Guidé par défaut, modes existants conservés', () => {
  const s = readFileSync('src/components/supplier-product-studio.tsx', 'utf8');
  assert.ok(s.includes("useState<Mode>('guided')"));
  for (const k of ["'quick', Zap", "'series', Rows3", "'import', FileSpreadsheet"]) assert.ok(s.includes(k), k);
  const g = readFileSync('src/components/supplier-guided-product.tsx', 'utf8');
  assert.ok(g.includes("api('/api/supplier/products'"));
});
