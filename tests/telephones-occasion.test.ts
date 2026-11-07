import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { conditionLabel, deviceTitle, maskId, publicRow, purchaseIssues, storageLabel, suggestedPrice, validateSellerId } from '../src/lib/used-devices';

test('Occasion : pièce d’identité du vendeur (CIN 8 chiffres, passeport), masquée', () => {
  assert.deepEqual(validateSellerId('CIN', ' 0987 6543 '), { ok: true, value: '09876543', last3: '543' });
  assert.equal(validateSellerId('CIN', '0987654').ok, false);
  assert.equal(validateSellerId('PASSPORT', 'x12345678').ok, true);
  assert.equal(validateSellerId('PASSPORT', 'AB1').ok, false);
  assert.equal(maskId('543'), '•••••543');
  const row = publicRow({ id: '1', sellerIdEncrypted: 'secret', sellerIdLast3: '543' } as any) as any;
  assert.equal(row.sellerIdEncrypted, undefined); assert.equal(row.sellerIdMasked, '•••••543');
});

test('Occasion : libellés d’étiquette, stockage, prix conseillé', () => {
  assert.equal(deviceTitle({ brand: 'Apple', model: 'iPhone 15', storageGb: 256 }), 'iPhone 15 · 256 Go');
  assert.equal(deviceTitle({ brand: 'Samsung', model: 'Galaxy S23', storageGb: 128 }), 'Samsung Galaxy S23 · 128 Go');
  assert.equal(storageLabel(1024), '1 To');
  assert.equal(conditionLabel('EXCELLENT'), 'Excellent état');
  assert.equal(suggestedPrice(1900, 'EXCELLENT'), 2375);
  assert.equal(suggestedPrice(1000, 'BON'), 1300);
  assert.equal(suggestedPrice(0, 'BON'), null);
});

test('Occasion : contrôles avant achat', () => {
  assert.deepEqual(purchaseIssues({ model: 'iPhone 15', imei: '490154203237518', purchasePrice: 1900, sellerName: 'Mohamed' }, true), []);
  const miss = purchaseIssues({ model: '', imei: '', purchasePrice: 0, sellerName: 'M', batteryHealth: 140 }, false);
  assert.equal(miss.length, 5);
});

test('Occasion : IMEI volé refusé, identité chiffrée, sortie de caisse, revente par la caisse, registre', () => {
  const api = readFileSync('src/app/api/used-devices/route.ts', 'utf8');
  for (const k of ['prisma.imeiReport.findFirst', 'signalé perdu ou volé', 'encryptSecret(id.value)', "category: 'Achat occasion'", "nextShopNumber(tx, s.shopId, 'USED', 'OCC')", 'déjà dans votre stock']) assert.ok(api.includes(k), k);
  const sell = readFileSync('src/app/api/used-devices/[id]/sell/route.ts', 'utf8');
  assert.ok(sell.includes('tx.counterSale.create') && sell.includes('unitCost: d.purchasePrice') && sell.includes('IMEI ${d.imei}') && sell.includes('Appareil déjà vendu'));
  const reg = readFileSync('src/app/api/used-devices/register/route.ts', 'utf8');
  assert.ok(reg.includes('requireSession([UserRole.ADMIN])') && reg.includes('decryptSecret(d.sellerIdEncrypted)') && reg.includes("format') === 'csv'"));
  assert.ok(readFileSync('src/app/api/used-devices/[id]/route.ts', 'utf8').includes("'REVEAL_SELLER_ID'"));
  const att = readFileSync('src/app/occasion/attestation/[id]/page.tsx', 'utf8');
  assert.ok(att.includes("'PRINT_ATTESTATION'") && att.includes('Exemplaire vendeur') && att.includes('amountInWords'));
  assert.ok(readFileSync('src/app/occasion/etiquette/[id]/page.tsx', 'utf8').includes('Batterie {d.batteryHealth} %'));
  assert.match(readFileSync('prisma/schema.prisma', 'utf8'), /model UsedDevice \{[^}]*sellerIdEncrypted String/);
  assert.ok(readFileSync('src/lib/nav-atelier.ts', 'utf8').includes("href: '/app/occasion'"));
});
