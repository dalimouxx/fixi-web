import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { issueFamily, priceStats, partQuery } from '../src/lib/price-hint';
import { splitInstallments, installmentStatus } from '../src/lib/installments';
import { orderStops, mapsRouteUrl, distanceKm } from '../src/lib/route-order';
import { restockSuggestion } from '../src/lib/restock';
import { monthRange, previousMonth, monthlyText } from '../src/lib/monthly-report';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

test('prix réseau : rien sous 3 ateliers, médiane et fourchette sinon', () => {
  assert.equal(issueFamily('Écran cassé / affichage'), 'ecran');
  assert.equal(issueFamily('Ne charge plus'), 'charge');
  assert.equal(priceStats([{ price: 100, shopId: 'a' }, { price: 120, shopId: 'b' }]), null);
  const s = priceStats([{ price: 100, shopId: 'a' }, { price: 120, shopId: 'b' }, { price: 140, shopId: 'c' }, { price: 110, shopId: 'a' }])!;
  assert.equal(s.shops, 3); assert.equal(s.repairs, 4); assert.equal(s.median, 115); assert.ok(s.low <= s.median && s.median <= s.high);
  assert.equal(partQuery({ model: 'Galaxy A54', reportedIssue: 'Écran cassé' }), 'écran Galaxy A54');
  assert.equal(partQuery({ model: 'A15', reportedIssue: 'bruit bizarre' }), 'A15');
});

test('paiement en plusieurs fois : découpage exact et échéances couvertes dans l’ordre', () => {
  const p = splitInstallments(100, 3, new Date('2026-11-05'));
  assert.deepEqual(p.map(x => x.amount), [33.333, 33.333, 33.334]);
  assert.equal(p.reduce((a, x) => a + x.amount, 0).toFixed(3), '100.000');
  assert.equal(p[1].dueDate.toISOString().slice(0, 10), '2026-12-05');
  const st = installmentStatus(p, 40, new Date('2026-12-10'));
  assert.equal(st[0].paid, true); assert.equal(st[1].paid, false); assert.equal(st[1].late, true);
  assert.equal(Number(st[1].remaining.toFixed(3)), 26.666);
  assert.equal(splitInstallments(50, 10, new Date()).length, 6, 'au plus 6 fois');
});

test('tournée : client le plus proche d’abord, itinéraire Google Maps', () => {
  const gabes = { lat: 33.88, lng: 10.10 };
  const stops = [{ id: 'sfax', lat: 34.74, lng: 10.76 }, { id: 'medenine', lat: 33.35, lng: 10.50 }, { id: 'mareth', lat: 33.62, lng: 10.30 }, { id: 'x', lat: null, lng: null }];
  const r = orderStops(stops, gabes);
  assert.deepEqual(r.ordered.map(s => s.id), ['mareth', 'medenine', 'sfax', 'x']);
  assert.ok(r.km > 100 && r.km < 300);
  assert.ok(distanceKm(gabes, { lat: 34.74, lng: 10.76 }) > 100);
  assert.match(mapsRouteUrl(r.ordered, gabes), /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&origin=33\.88,10\.1&destination=34\.74,10\.76&waypoints=/);
});

test('réapprovisionnement conseillé', () => {
  const s = restockSuggestion({ weeklyQty: [10, 10, 10, 10, 10, 10, 10, 10], stock: 8, reserved: 2, minStock: 5 });
  assert.equal(s.avgPerWeek, 10); assert.equal(s.available, 6); assert.equal(s.suggested, 19); assert.equal(s.urgent, true);
  assert.equal(restockSuggestion({ weeklyQty: [0, 0], stock: 3 }).suggested, 0);
});

test('rapport du mois', () => {
  const { start, end } = monthRange('2026-10');
  assert.equal(start.getMonth(), 9); assert.equal(end.getMonth(), 10);
  assert.equal(previousMonth(new Date(2026, 0, 2)), '2025-12');
  assert.match(monthlyText({ shop: 'Fixi Gabès', ym: '2026-10', revenue: '4 200 DT', profit: '2 100 DT', repairs: 80, delivered: 75, topIssue: 'Écran', link: 'https://x/app/rapport-mensuel?m=2026-10' }), /octobre 2026[\s\S]*Encaissé : 4 200 DT[\s\S]*panne n°1 : Écran/);
});

test('écrans et routes branchés', () => {
  for (const p of ['src/app/api/imei/check/route.ts', 'src/app/api/imei/report/route.ts', 'src/app/api/network/price-hint/route.ts', 'src/app/api/counter/route.ts', 'src/app/comptoir/page.tsx', 'src/app/catalogue/[slug]/page.tsx', 'src/app/api/supplier/restock/route.ts', 'src/app/api/export/accounting/route.ts', 'src/app/(app)/app/rapport-mensuel/page.tsx'])
    assert.ok(fs.existsSync(path.join(root, p)), p);
  assert.match(read('src/app/api/network/price-hint/route.ts'), /priceStats/);
  assert.doesNotMatch(read('src/app/api/imei/check/route.ts'), /shop: \{|name:/, 'jamais le nom de l’atelier qui signale');
  assert.match(read('src/app/catalogue/[slug]/page.tsx'), /publicCatalog\) notFound/);
  assert.match(read('src/app/api/repairs/[code]/attachments/route.ts'), /VOICE_NOTE/);
  assert.match(read('src/components/repair-detail.tsx'), /<VoiceNote/);
  assert.match(read('src/components/driver-app.tsx'), /orderStops/);
  assert.match(read('prisma/schema.prisma'), /model RepairInstallment/);
});
