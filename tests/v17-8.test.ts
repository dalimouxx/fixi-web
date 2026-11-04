import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { driverStats, trackKm } from '../src/lib/field-ops';

test('kilomètres GPS : sauts aberrants et micro-mouvements ignorés', () => {
  const t = (m: number) => new Date(Date.UTC(2026, 10, 4, 9, m));
  const km = trackKm([{ lat: 33.8815, lng: 10.0982, at: t(0) }, { lat: 33.8869, lng: 10.103, at: t(3) }, { lat: 33.88691, lng: 10.10301, at: t(4) }, { lat: 34.74, lng: 10.76, at: t(5) }]);
  assert.ok(km > 0.6 && km < 0.8, String(km));
});
test('statistiques livreurs', () => {
  const at = (h: number) => new Date(Date.UTC(2026, 10, 4, h));
  const r = driverStats({ drivers: [{ id: 'a', name: 'Ali' }, { id: 'b', name: 'Bilel' }], deliveries: [{ driverId: 'a', pickedUpAt: at(9), deliveredAt: at(10) }, { driverId: 'a', pickedUpAt: at(11), deliveredAt: new Date(at(11).getTime() + 30 * 60000) }, { driverId: 'b', pickedUpAt: null, deliveredAt: at(12) }], failures: [{ driverId: 'b' }], km: { a: 12.4 }, bonusPerDelivery: 1.5 });
  assert.deepEqual(r.map(x => x.driverId), ['a', 'b']);
  assert.deepEqual([r[0].delivered, r[0].successPct, r[0].avgMinutes, r[0].bonus, r[0].km], [2, 100, 45, 3, 12.4]);
  assert.deepEqual([r[1].failed, r[1].successPct, r[1].avgMinutes], [1, 50, null]);
});
test('signature et reprises branchées', () => {
  assert.ok(readFileSync('src/app/api/delivery/orders/[id]/route.ts', 'utf8').includes('signatureUrl'));
  assert.ok(readFileSync('src/components/delivery-ticket.tsx', 'utf8').includes('Signature du réceptionnaire'));
  assert.match(readFileSync('src/app/api/marketplace/returns/route.ts', 'utf8'), /60 \* 86400_000/);
});
