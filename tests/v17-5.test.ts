import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dailySeries, einvoiceChecks, monthlyPrice, normalizeMatricule, pickTrialPlan, progress, startSteps, trialEligible, usualParts } from '../src/lib/growth';
import { base32Decode, base32Encode, totpAt, verifyTotp } from '../src/lib/totp';
import { legalDocs } from '../src/lib/legal';

const plan = (o: any) => ({ id: o.code, name: o.code, active: true, publicVisible: true, trialDays: 0, price: 39, durationValue: 1, durationUnit: 'MONTH', ...o });

test('essai : offre avec jours d’essai, sinon la moins chère avec 14 jours', () => {
  assert.equal(pickTrialPlan([plan({ code: 'CONNECT', price: 0 }), plan({ code: 'PRO', price: 69 }), plan({ code: 'STARTER', price: 39 })])!.plan.code, 'STARTER');
  assert.equal(pickTrialPlan([plan({ code: 'STARTER' })])!.days, 14);
  const t = pickTrialPlan([plan({ code: 'STARTER' }), plan({ code: 'PRO', price: 69, trialDays: 30 })])!;
  assert.deepEqual([t.plan.code, t.days], ['PRO', 30]);
  assert.equal(pickTrialPlan([plan({ code: 'CONNECT', price: 0 })]), null);
  assert.equal(monthlyPrice(360, 1, 'YEAR'), 30);
});
test('un seul essai par atelier', () => {
  assert.equal(trialEligible([{ status: 'ACTIVE', plan: { code: 'CONNECT' } }]), true);
  assert.equal(trialEligible([{ status: 'TRIAL', plan: { code: 'STARTER' } }]), false);
});
test('premiers pas', () => {
  const s = startSteps({ hasAddress: true, ordered: false, delivered: false, invited: false, pro: false });
  assert.equal(s[0].key, 'account'); assert.deepEqual(progress(s), { done: 2, total: 6, pct: 33 });
});
test('séries quotidiennes continues', () => {
  const now = new Date('2026-11-04T10:00:00Z');
  const s = dailySeries([new Date('2026-11-04T08:00:00Z'), new Date('2026-11-04T09:00:00Z'), new Date('2026-11-02T12:00:00Z')], 5, now);
  assert.equal(s.length, 5); assert.equal(s[4].count, 2); assert.equal(s[2].count, 1); assert.equal(s[3].count, 0);
});
test('pièces habituelles : au moins 2 commandes, quantité médiane', () => {
  const r = usualParts([{ productId: 'a', quantity: 2, orderId: 'o1', at: '2026-10-01' }, { productId: 'a', quantity: 4, orderId: 'o2', at: '2026-10-10' }, { productId: 'a', quantity: 3, orderId: 'o3', at: '2026-10-20' }, { productId: 'b', quantity: 9, orderId: 'o1', at: '2026-10-01' }]);
  assert.equal(r.length, 1); assert.deepEqual([r[0].productId, r[0].qty, r[0].times], ['a', 3, 3]);
});
test('TOTP conforme RFC 6238 (vecteur officiel SHA-1)', () => {
  const secret = base32Encode(Buffer.from('12345678901234567890'));
  assert.equal(base32Decode(secret).toString(), '12345678901234567890');
  assert.equal(totpAt(secret, Math.floor(59 / 30), 8), '94287082');
  assert.equal(totpAt(secret, Math.floor(1111111109 / 30), 8), '07081804');
  const now = 1_700_000_000_000, code = totpAt(secret, Math.floor(now / 30000));
  assert.equal(verifyTotp(secret, code, now), true);
  assert.equal(verifyTotp(secret, code, now + 95_000), false);
  assert.equal(verifyTotp(secret, 'abc', now), false);
});
test('matricule fiscal et contrôles El Fatoora', () => {
  assert.equal(normalizeMatricule('1234567 a a m 000'), '1234567A/A/M/000');
  assert.equal(normalizeMatricule('1234567A/A/M/000'), '1234567A/A/M/000');
  assert.equal(normalizeMatricule('123'), null);
  const c = einvoiceChecks({ taxId: '1234567A/A/M/000', legalName: 'X SARL', address: 'Gabès', b2bCustomers: 3, b2bMissingTaxId: 1, products: 4, productsWithVat: 4, sales90: 10 });
  assert.deepEqual(c.map(x => x.ok), [true, true, false, true]);
});
test('pages légales : 3 documents, contact repris des réglages', () => {
  const d = legalDocs({ app: 'Fixi', email: 'support@fixi.tn', phone: '' });
  assert.deepEqual(d.map(x => x.slug), ['conditions', 'confidentialite', 'mentions-legales']);
  assert.ok(JSON.stringify(d).includes('support@fixi.tn'));
  assert.ok(JSON.stringify(d).includes('2004-63'));
});
test('sécurité : version de session vérifiée, promo appliquée côté serveur', () => {
  assert.match(readFileSync('src/lib/supplier-auth.ts', 'utf8'), /sessionVersion/);
  assert.match(readFileSync('src/lib/platform-auth.ts', 'utf8'), /sessionVersion/);
  assert.match(readFileSync('src/app/api/marketplace/orders/route.ts', 'utf8'), /activePromos\(ids\)/);
});
