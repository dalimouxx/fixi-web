import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cleanTyped, modelCode, nextFreeCode, smartBase, typeCode } from '../src/lib/smart-barcode';
import { cleanStockIn, findByCode, newAverageCost } from '../src/lib/stock-in';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('Code intelligent : 4 chiffres du type + modèle (afficheur A04 → 0000A04)', () => {
  const cases: [string, string][] = [
    ['Écran Samsung A04 Incell', '0000A04'], ['Afficheur Galaxy A04s', '0000A04S'], ['Batterie iPhone 13', '0001IP13'],
    ['Écran iPhone 13 Pro Max OLED', '0000IP13PM'], ['Écran iPhone XR', '0000IPXR'], ['Connecteur de charge Redmi Note 12 Pro', '0002RN12P'],
    ['Vitre arrière Redmi 9A', '0003R9A'], ['Écran Poco X3 Pro', '0000PX3P'], ['Batterie Tecno Spark 10 Pro', '0001SP10P'],
    ['Écran Infinix Hot 30', '0000H30'], ['Écran Samsung S23 Ultra', '0000S23U'], ['Nappe Samsung Note 10 Plus', '0005N10P'],
    ['Batterie Samsung A12', '0001A12'], ['Verre trempé Galaxy A54', '0009A54'], ['Écran Huawei Nova 9', '0000NOVA9'],
  ];
  for (const [name, code] of cases) assert.equal(smartBase(name), code, name);
  assert.equal(modelCode('Chargeur rapide 20 W'), '', 'une puissance n’est pas un modèle');
  assert.equal(modelCode('Câble USB-C 1 m'), '');
  assert.equal(typeCode('Pièce mystère'), '0099');
  assert.equal(typeCode('X', 'Batteries'), '0001', 'la catégorie choisie prime');
});

test('Codes Fixi générés uniques sur toute la plateforme ; code saisi (ex. code de l’importateur MG) unique dans un même catalogue', () => {
  assert.equal(nextFreeCode('0000A04', []), '0000A04');
  assert.equal(nextFreeCode('0000A04', ['0000A04']), '0000A04-2');
  assert.equal(nextFreeCode('0000A04', ['0000a04', '0000A04-2']), '0000A04-3', 'casse ignorée');
  assert.equal(nextFreeCode('0009', []), '00090001', 'sans modèle : numéro');
  assert.equal(nextFreeCode('0009', ['00090001']), '00090002');
  const lib = read('src/lib/supplier-barcode.ts');
  assert.match(lib, /barcode: \{ equals: code, mode: 'insensitive' \}/); assert.doesNotMatch(lib.split('export async function barcodeOwner')[1].split('}')[0], /companyId/, 'recherche sur TOUS les fournisseurs');
  // Code généré : recherche des codes déjà pris sur TOUTE la plateforme.
  assert.match(lib.split('export async function generateBarcode')[1].split('return code')[0], /barcode: \{ startsWith: base/);
  // Code saisi : refusé seulement s'il existe déjà dans le même catalogue (MG colle le même code chez plusieurs fournisseurs).
  const resolve = lib.split('export async function resolveBarcode')[1];
  assert.match(resolve, /where: \{ companyId, barcode: \{ equals: typed, mode: 'insensitive' \}/);
  assert.match(resolve, /déjà utilisé dans votre catalogue/);
  for (const p of ['src/app/api/supplier/products/route.ts', 'src/lib/supplier-product-quick.ts', 'src/app/api/supplier/products/import/route.ts']) assert.match(read(p), /resolveBarcode\(/, p);
  assert.match(read('prisma/schema.prisma'), /@@index\(\[barcode\]\)/);
  assert.doesNotMatch(read('prisma/schema.prisma'), /@@unique\(\[barcode\]\)/, 'pas de contrainte unique (db push sans perte)');
});

test('Saisie à la main tolérante', () => {
  assert.equal(cleanTyped(' 0000 a04 '), '0000A04');
  const items = [{ sku: 'ECR-SAM-0001', barcode: '0000A04' }, { sku: 'BAT-1', barcode: null }];
  assert.equal(findByCode(items, '0000 a04')?.sku, 'ECR-SAM-0001');
  assert.equal(findByCode(items, 'bat-1')?.sku, 'BAT-1');
  assert.equal(findByCode(items, ''), undefined);
});

test('Entrée de stock : lignes propres et coût moyen', () => {
  assert.deepEqual(cleanStockIn([{ productId: 'a', quantity: 2, unitCost: '10,5' }, { productId: 'a', quantity: 1 }, { productId: 'b', quantity: 0 }, { productId: 'c', quantity: 3, unitCost: -1 }]), [{ productId: 'a', quantity: 3, unitCost: 10.5 }]);
  assert.equal(newAverageCost(10, 20, 10, 30), 25);
  assert.equal(newAverageCost(-2, 20, 4, 30), 30, 'stock négatif compté 0');
  const api = read('src/app/api/supplier/stock-in/route.ts');
  assert.match(api, /type: 'STOCK_IN'/); assert.doesNotMatch(api, /supplierErpPurchase\.create/, 'pas de fausse dette fournisseur');
  assert.match(api, /requireSupplierRole\(ROLES\)/);
});

test('Caisses Windows : écrans « Entrée de stock » et accès autorisés', () => {
  assert.match(read('apps/windows-pos/src/CaisseV4.tsx'), /page==='entree'&&<StockInPage/);
  assert.match(read('apps/windows-pos/src/atelier.tsx'), /tab === 'stock' && <AtelierStockIn/);
  const rs = read('apps/windows-pos/src-tauri/src/lib.rs'); assert.match(rs, /supplier_stock_in_costs,supplier_stock_in,/);
  assert.match(read('apps/windows-pos/src-tauri/src/atelier.rs'), /\("POST", \["api", "purchases"\]\)/);
  assert.match(read('src/app/api/marketplace/orders/[id]/receive/route.ts'), /barcode:x\.product\.barcode/, 'l’atelier reprend le code du fournisseur');
});
