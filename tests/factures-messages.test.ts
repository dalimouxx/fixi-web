import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { amountInWords, formatNumber, integerInWords, tnTotals } from '../src/lib/tn-invoice';
import { fillMessage } from '../src/lib/client-messages';

test('Montant en lettres : règles françaises (et, vingts, cents, mille)', () => {
  const cases: [number, string][] = [[0, 'zéro'], [1, 'un'], [17, 'dix-sept'], [21, 'vingt-et-un'], [71, 'soixante-et-onze'], [72, 'soixante-douze'], [80, 'quatre-vingts'], [81, 'quatre-vingt-un'], [91, 'quatre-vingt-onze'], [100, 'cent'], [200, 'deux-cents'], [201, 'deux-cent-un'], [1000, 'mille'], [2000, 'deux-mille'], [200000, 'deux-cent-mille'], [1500000, 'un-million-cinq-cent-mille']];
  for (const [n, w] of cases) assert.equal(integerInWords(n), w, String(n));
  assert.equal(amountInWords(240.785), 'deux-cent-quarante dinars et sept-cent-quatre-vingt-cinq millimes');
  assert.equal(amountInWords(1), 'un dinar');
  assert.equal(amountInWords(0.5), 'zéro dinar et cinq-cents millimes');
});

test('Facture tunisienne : HT, TVA, timbre, TTC et numéro continu', () => {
  const t = tnTotals([{ quantity: 1, unitPrice: 180 }, { quantity: 1, unitPrice: 21.5 }], 0, 19, 1);
  assert.deepEqual(t, { subtotal: 201.5, discount: 0, taxRate: 19, taxAmount: 38.285, stampDuty: 1, total: 240.785 });
  assert.equal(tnTotals([{ quantity: 2, unitPrice: 10 }], 50, 19, 0).total, 0, 'remise bornée au HT');
  assert.equal(formatNumber('fac', 2026, 42), 'FAC-2026-000042');
});

test('Factures : numéro via séquence en transaction, timbre réglable, mentions imprimées', () => {
  const api = readFileSync('src/app/api/documents/route.ts', 'utf8');
  assert.ok(api.includes('nextShopNumber(tx,s.shopId,type,prefix)') && api.includes('shop.invoiceStampDuty?FISCAL_STAMP_TND:0') && !api.includes('getTime().toString().slice(-7)'));
  assert.ok(readFileSync('src/app/api/documents/[id]/convert/route.ts', 'utf8').includes("nextShopNumber(tx,q.shopId,'INVOICE'"));
  const page = readFileSync('src/app/(app)/app/documents/[id]/page.tsx', 'utf8');
  for (const k of ['MF : {d.shop.taxId}', 'RNE : {d.shop.tradeRegister}', 'MF : {d.client.taxId}', 'Timbre fiscal', 'Total TTC', 'amountInWords(Number(d.total))']) assert.ok(page.includes(k), k);
  assert.match(readFileSync('prisma/schema.prisma', 'utf8'), /model ShopSequence \{[^}]*@@unique\(\[shopId, key\]\)/);
});

test('Messages automatiques : modèle Meta, repli texte, une fois par 24 h, journalisés', () => {
  assert.equal(fillMessage('Bonjour {client}, votre {device} ({code}) : {balance} {currency}', { client: 'Sami', device: 'A54', code: 'F-1', balance: '90.000', currency: 'DT' }), 'Bonjour Sami, votre A54 (F-1) : 90.000 DT');
  const lib = readFileSync('src/lib/client-messages.ts', 'utf8');
  assert.ok(lib.includes('sendWhatsAppTemplate(') && lib.includes('sendWhatsAppText(') && lib.includes("title: `AUTO_${notice}`") && lib.includes('24 * 3600_000'));
  assert.ok(readFileSync('src/lib/whatsapp.ts', 'utf8').includes("type:'template'"));
  assert.ok(readFileSync('src/app/api/repairs/[code]/status/route.ts', 'utf8').includes("void notifyRepairClient(r.id,'READY')"));
  assert.ok(readFileSync('src/app/api/repairs/route.ts', 'utf8').includes("void notifyRepairClient(repair.id, 'RECEIVED')"));
});
