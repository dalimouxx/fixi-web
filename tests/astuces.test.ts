import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { commissionFor, monthRange } from '../src/lib/commissions';
import { restockPlan, restockSentence } from '../src/lib/shop-restock';
import { summaryText, tunisNow } from '../src/lib/evening-summary';

test('IMEI → modèle : TAC = 8 premiers chiffres, appris à chaque réparation et achat', () => {
  const tac = readFileSync('src/lib/tac.ts', 'utf8');
  assert.ok(tac.includes('d.slice(0, 8)') && tac.includes('count: { decrement: 1 }'));
  assert.ok(readFileSync('src/app/api/repairs/route.ts', 'utf8').includes('learnTac(repair.serialNumber, repair.brand, repair.model)'));
  assert.ok(readFileSync('src/app/api/used-devices/route.ts', 'utf8').includes('learnTac(imei, device.brand, device.model)'));
  assert.ok(readFileSync('src/app/(app)/app/repairs/new/page.tsx', 'utf8').includes("/api/imei/model?imei="));
});

test('Arrivée QR : public, limité, doublon refusé, relié au dossier créé', () => {
  const api = readFileSync('src/app/api/public/checkin/[slug]/route.ts', 'utf8');
  assert.ok(api.includes("loginGuard('checkin'") && api.includes('Vous êtes déjà enregistré') && api.includes('consent'));
  assert.ok(readFileSync('src/app/api/repairs/route.ts', 'utf8').includes("status: 'CONVERTED', repairId: repair.id"));
  assert.ok(readFileSync('src/app/(app)/app/repairs/new/page.tsx', 'utf8').includes('<CheckInBanner onPick={pickCheckIn}'));
});

test('Résumé du soir : heure de Tunis, texte complet, une seule fois par jour', () => {
  const t = tunisNow(new Date('2026-11-06T19:30:00Z'));
  assert.deepEqual(t, { day: '2026-11-06', hour: 20 });
  const txt = summaryText('Mon Atelier', { day: '2026-11-06', net: 3370.97, count: 33, byMethod: {}, received: 5, delivered: 2, readyToCollect: 4, readyOver3Days: 1, overdue: 2, counterSales: { count: 3, total: 120 }, usedSold: 1, cashOpen: true, expectedCash: 990.97 });
  for (const k of ['06/11/2026', '3370,970 DT', 'À rendre : 4 (dont 1 depuis plus de 3 jours)', 'En retard : 2', 'Ventes comptoir : 3', 'espèces attendues : 990,970 DT']) assert.ok(txt.includes(k), k);
  const daily = readFileSync('src/app/api/system/daily/route.ts', 'utf8');
  assert.ok(daily.includes("lastEveningSummary: { not: day }") && daily.includes("title: 'AUTO_REVIEW'") && daily.includes('2 * 3600_000'));
  assert.ok(readFileSync('src/instrumentation.ts', 'utf8').includes("call('/api/system/daily')"));
});

test('Commissions : % de la marge des réparations rendues', () => {
  const r = commissionFor([{ technicianId: 't', finalPrice: 200, discountAmount: 20, partsCost: 80 }, { technicianId: 't', finalPrice: 100, discountAmount: 0, partsCost: 120 }], 10);
  assert.deepEqual(r, { count: 2, revenue: 280, parts: 200, margin: 80, rate: 10, commission: 8 });
  assert.equal(commissionFor([], null).commission, 0);
  assert.equal(monthRange('2026-11').month, '2026-11');
});

test('Réassort : vitesse de sortie sur 28 jours, jours restants, quantité pour 14 jours', () => {
  const plan = restockPlan([{ id: 'v', name: 'Verre trempé', sku: 'VT', quantity: 3, minQuantity: 2 }, { id: 'c', name: 'Coque', sku: 'C', quantity: 40, minQuantity: 2 }], [{ inventoryItemId: 'v', quantityChange: -48 }, { inventoryItemId: 'c', quantityChange: -4 }, { inventoryItemId: 'v', quantityChange: 10 }]);
  assert.equal(plan.length, 1);
  assert.equal(plan[0].perWeek, 12); assert.equal(plan[0].daysLeft, 1); assert.equal(plan[0].suggested, 21);
  assert.equal(restockSentence(plan[0]), 'Vous en sortez 12 par semaine, il en reste 3 (≈ 1 j). À commander : 21.');
});

test('Étiquette garantie QR et demande d’avis', () => {
  const lbl = readFileSync('src/app/etiquette/garantie/[code]/page.tsx', 'utf8');
  assert.ok(lbl.includes('/warranty/${r.digitalWarranty.publicToken}') && lbl.includes('<QrCanvas'));
  assert.ok(readFileSync('src/components/repair-detail.tsx', 'utf8').includes('/etiquette/garantie/'));
});
