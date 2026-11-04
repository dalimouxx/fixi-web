import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { aging, creditOverflow, etaMinutes, haversineKm, reminderLevel, reminderText, shouldRemind } from '../src/lib/field-ops';

const now = new Date('2026-11-04T12:00:00Z').getTime();
const day = (n: number) => new Date(now - n * 86400_000).toISOString();

test('ancienneté : solde net (avoirs, paiements) et plus vieille facture non soldée', () => {
  const a = aging([{ id: '1', total: 100, paid: 100, createdAt: day(60) }, { id: '2', total: 200, paid: 50, credit: 20, createdAt: day(18) }, { id: '3', total: 40, paid: 0, createdAt: day(2) }], now);
  assert.deepEqual(a, { due: 170, days: 18 });
  assert.equal(aging([{ id: 'x', total: 50, paid: 0, createdAt: day(40), dueAt: day(10) }], now).days, 10);
});
test('paliers de relance et anti-harcèlement', () => {
  assert.deepEqual([3, 7, 16, 45].map(reminderLevel), [0, 7, 15, 30]);
  assert.equal(shouldRemind(7, null, now), true);
  assert.equal(shouldRemind(7, { level: 7, at: day(10) }, now), false);
  assert.equal(shouldRemind(15, { level: 7, at: day(2) }, now), false);
  assert.equal(shouldRemind(15, { level: 7, at: day(8) }, now), true);
  assert.match(reminderText(30, { customer: 'GSM', supplier: 'Pièces Sud', due: '120,000 DT', days: 33 }), /33 jours/);
});
test('plafond de crédit', () => {
  assert.equal(creditOverflow(0, 900, 100), 0);
  assert.equal(creditOverflow(500, 300, 150), 0);
  assert.equal(creditOverflow(500, 450, 120), 70);
});
test('arrivée estimée du livreur', () => {
  const km = haversineKm({ lat: 33.8815, lng: 10.0982 }, { lat: 33.8869, lng: 10.1030 });
  assert.ok(km > 0.6 && km < 0.8);
  assert.equal(etaMinutes(km), 3);
  assert.equal(etaMinutes(0), 1);
});
test('commande atelier : plafond vérifié, nouvelle tentative auto, arrivée annoncée', () => {
  assert.match(readFileSync('src/app/api/marketplace/orders/route.ts', 'utf8'), /creditOverflow\(/);
  const ev = readFileSync('src/app/api/delivery/events/route.ts', 'utf8');
  assert.ok(ev.includes('SHOP_CLOSED') && ev.includes('RESCHEDULED') && ev.includes('MAX_ATTEMPTS'));
  assert.ok(readFileSync('src/app/api/delivery/orders/[id]/route.ts', 'utf8').includes("type:'ETA_SOON'"));
});
