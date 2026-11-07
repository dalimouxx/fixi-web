import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkVerification, isVerified, normalizeTaxId } from '../src/lib/shop-verification';
import { cleanIssues, issuesText, issuesTotal } from '../src/lib/repair-issues';
import { deleteMode, stripCosts } from '../src/lib/stock-delete';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const IMG = 'data:image/jpeg;base64,AAAA';

test('Vérification : matricule fiscal tunisien', () => {
  assert.equal(normalizeTaxId('1234567A/A/M/000'), '1234567A/A/M/000');
  assert.equal(normalizeTaxId('1234567 a a m 000'), '1234567A/A/M/000');
  assert.equal(normalizeTaxId('1234567/A'), '1234567A');
  assert.equal(normalizeTaxId('123456A'), null); assert.equal(normalizeTaxId('abc'), null);
});

test('Vérification : dossier complet exigé', () => {
  const ok = { legalName: 'GSM Gabès', ownerName: 'Ali Ben Salah', taxId: '1234567A/A/M/000', address: 'Rue de Tunis, Gabès', documentUrl: IMG, facadeUrl: IMG };
  assert.equal(checkVerification(ok).ok, true);
  assert.match((checkVerification({ ...ok, facadeUrl: '' }) as any).error, /façade/);
  assert.match((checkVerification({ ...ok, taxId: '12' }) as any).error, /Matricule/);
  assert.equal(isVerified('VERIFIED'), true); assert.equal(isVerified('PENDING'), false);
});

test('Vérification : catalogue fournisseurs fermé tant que Fixi n’a pas validé', () => {
  for (const p of ['src/app/api/marketplace/products/route.ts', 'src/app/api/marketplace/usual/route.ts', 'src/app/api/marketplace/orders/route.ts', 'src/app/api/marketplace/part-requests/route.ts', 'src/app/api/marketplace/stock-alerts/route.ts'])
    assert.match(read(p), /requireVerifiedShop\(s[v]?\.shopId\)/, p);
  assert.match(read('src/app/api/public/signup/route.ts'), /verificationStatus: 'NONE'/);
  const schema = read('prisma/schema.prisma');
  assert.match(schema, /verificationStatus +String +@default\("VERIFIED"\)/, 'les boutiques existantes restent ouvertes');
  assert.match(schema, /model ShopVerification \{/);
  assert.match(read('src/app/api/platform/verifications/route.ts'), /requirePlatformSession/);
  assert.match(read('src/components/saas-dashboard.tsx'), /<ControlVerifications\/>/);
});

test('Plusieurs pannes dans une réparation', () => {
  const list = cleanIssues([{ name: 'Écran', price: '120' }, { name: 'batterie', price: 45.5 }, { name: 'écran', price: 1 }, { name: 'x' }, { name: 'Connecteur', price: '' }]);
  assert.deepEqual(list, [{ name: 'Écran', price: 120 }, { name: 'batterie', price: 45.5 }, { name: 'Connecteur', price: null }]);
  assert.equal(issuesText(list), 'Écran + batterie + Connecteur');
  assert.equal(issuesText(list, 'tactile mort'), 'Écran + batterie + Connecteur — tactile mort');
  assert.equal(issuesTotal(list), 165.5); assert.equal(issuesTotal([{ name: 'A', price: null }]), null);
  assert.match(read('src/app/api/repairs/route.ts'), /cleanIssues\(raw\?\.issues\)/);
  assert.match(read('src/app/(app)/app/repairs/new/page.tsx'), /toggleIssue/);
});

test('Supprimer / archiver, modifier, retirer une pièce, dépenses, fournisseurs', () => {
  assert.equal(deleteMode({ sales: 0, moves: 0 }), 'DELETE'); assert.equal(deleteMode({ sales: 2 }), 'ARCHIVE');
  assert.deepEqual(stripCosts({ id: 'a', purchasePrice: 3, averageCost: 2, minimumPrice: 1, price: 9 }), { id: 'a', price: 9 });
  assert.match(read('src/app/api/stock/[id]/route.ts'), /export async function DELETE/);
  const sp = read('src/app/api/supplier/products/[id]/route.ts');
  assert.match(sp, /export async function DELETE/); assert.doesNotMatch(sp, /requireSupplierSession\(\)/, 'plus de modification par un livreur');
  assert.match(read('src/app/api/supplier/products/route.ts'), /SUPPLIER_COST_ROLES\.includes\(s\.role\)\?rows:rows\.map\(stripCosts\)/);
  assert.match(read('src/app/api/repairs/[code]/parts/route.ts'), /export async function DELETE[\s\S]*StockMovementType\.RETURN/);
  assert.match(read('src/app/api/repairs/[code]/route.ts'), /export async function PATCH/);
  const ex = read('src/app/api/expenses/[id]/route.ts'); assert.match(ex, /caisse déjà clôturée/); assert.match(ex, /export async function DELETE/);
  assert.match(read('src/app/api/suppliers/[id]/route.ts'), /export async function DELETE/);
  assert.match(read('src/app/(app)/app/purchases/page.tsx'), /<ShopSuppliersPanel/);
});
