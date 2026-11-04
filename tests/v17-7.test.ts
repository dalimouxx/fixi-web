import test from 'node:test';
import assert from 'node:assert/strict';
import { applyScan, bucketize, churnRisk, pickOrder, pickingDone, requestVisible, validPartRequest } from '../src/lib/commerce';

const now = new Date('2026-11-04T12:00:00Z').getTime();
const day = (n: number) => new Date(now - n * 86400_000);

test('visibilité des demandes : région (sans accents) ou toute la Tunisie', () => {
  assert.equal(requestVisible('REGION', 'Gabès', 'gabes'), true);
  assert.equal(requestVisible('REGION', 'Gabès', 'Sfax'), false);
  assert.equal(requestVisible('ALL', 'Gabès', 'Sfax'), true);
  assert.equal(requestVisible('REGION', null, 'Sfax'), false);
  assert.equal(validPartRequest({ partName: 'ab' }).ok, false);
  const v = validPartRequest({ partName: '  Nappe de charge  ', quantity: '2', scope: 'ALL' });
  assert.ok(v.ok && v.value.partName === 'Nappe de charge' && v.value.quantity === 2 && v.value.scope === 'ALL');
});
test('client qui décroche', () => {
  assert.equal(churnRisk([day(5), day(12), day(19)], now), null);
  const r = churnRisk([day(40), day(47), day(54), day(61)], now)!;
  assert.deepEqual([r.orders, r.everyDays, r.silentDays], [4, 7, 40]);
  assert.equal(churnRisk([day(30), day(40)], now), null);
});
test('préparation au scanner : ordre, mauvaise pièce, quantité', () => {
  const lines = pickOrder([{ itemId: 'b', productId: 'pb', name: 'Batterie', quantity: 2, codes: ['619B'], location: 'B2' }, { itemId: 'a', productId: 'pa', name: 'Écran', quantity: 1, codes: ['619A', 'ECR-1'], location: 'A1' }, { itemId: 'c', productId: 'pc', name: 'Colle', quantity: 1, codes: [], location: null }]);
  assert.deepEqual(lines.map(l => l.itemId), ['a', 'b', 'c']);
  let p: Record<string, number> = {};
  assert.equal(applyScan(lines, p, 'XXX').ok, false);
  let r = applyScan(lines, p, 'ecr-1'); assert.ok(r.ok); p = (r as any).picked;
  r = applyScan(lines, p, '619A'); assert.equal(r.ok, false);
  p = (applyScan(lines, p, '619B') as any).picked; p = (applyScan(lines, p, '619B') as any).picked;
  assert.equal(pickingDone(lines, p), false);
  assert.equal(pickingDone(lines, { ...p, c: 1 }), true);
});
test('encaissements par période', () => {
  const b = bucketize([{ amount: 100, at: day(3) }, { amount: 50, at: new Date(now + 2 * 86400_000) }, { amount: 30, at: new Date(now + 20 * 86400_000) }, { amount: 10, at: new Date(now + 60 * 86400_000) }, { amount: -5, at: null }], now);
  assert.deepEqual(b, { overdue: 100, week: 50, month: 30, later: 10 });
});
