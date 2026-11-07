import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gs1Valid, matchScan, normalizeBarcode } from '../src/lib/barcode';

test('Code-barres : nettoyage de la lecture douchette', () => {
  assert.equal(normalizeBarcode(' 6 194 0010 1234 5 \n'), '6194001012345');
  assert.equal(normalizeBarcode('acc-vt-uni'), 'ACC-VT-UNI');
  assert.equal(normalizeBarcode('   '), null);
  assert.equal(normalizeBarcode(null), null);
});

test('Code-barres : clé de contrôle GS1 (EAN-13, EAN-8, UPC-A)', () => {
  assert.equal(gs1Valid('4006381333931'), true);   // EAN-13
  assert.equal(gs1Valid('4006381333932'), false);
  assert.equal(gs1Valid('73513537'), true);        // EAN-8
  assert.equal(gs1Valid('036000291452'), true);    // UPC-A
  assert.equal(gs1Valid('ACC-12'), null, 'code interne : pas de contrôle');
});

test('Code-barres : le scan retrouve l’article par code-barres puis par référence', () => {
  const items = [{ sku: 'ACC-COQ', barcode: '4006381333931', name: 'Coque' }, { sku: 'ACC-CBL', barcode: null, name: 'Câble' }];
  assert.equal(matchScan(items, ' 4006381333931')?.name, 'Coque');
  assert.equal(matchScan(items, 'acc-cbl')?.name, 'Câble');
  assert.equal(matchScan(items, '999'), undefined);
});

test('Code-barres : schéma, API stock, recherche, vente comptoir web et caisse Windows', () => {
  const schema = readFileSync('prisma/schema.prisma', 'utf8');
  assert.match(schema, /barcode\s+String\?/); assert.match(schema, /@@index\(\[shopId, barcode\]\)/); assert.ok(!/@@unique\(\[shopId, barcode\]\)/.test(schema), 'pas de contrainte unique : db push du déploiement ne doit rien demander');
  const post = readFileSync('src/app/api/stock/route.ts', 'utf8');
  assert.ok(post.includes('barcode:normalizeBarcode(b.barcode)') && post.includes('barcodeTaken(tx,s.shopId'));
  assert.ok(readFileSync('src/app/api/stock/[id]/route.ts', 'utf8').includes('normalizeBarcode(b.barcode)'));
  assert.ok(readFileSync('src/app/api/counter-sales/route.ts', 'utf8').includes('barcode: { equals: normalizeBarcode(q)'));
  const page = readFileSync('src/app/(app)/app/stock/page.tsx', 'utf8');
  assert.ok(page.includes('<BarcodeCamera') && page.includes('gs1Valid(code)'));
  assert.ok(readFileSync('src/components/counter-sale.tsx', 'utf8').includes('matchScan(items, raw)'));
  assert.ok(readFileSync('apps/windows-pos/src/atelier-comptoir.tsx', 'utf8').includes("(i.barcode || '').toUpperCase() === code.toUpperCase()"));
});
