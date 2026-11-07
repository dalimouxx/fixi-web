import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { summarize } from '../src/lib/driver-cash';
import { handoverOk, newHandoverCode, pickupMode, pickupStep } from '../src/lib/return-pickup';
import { watchReasons } from '../src/lib/watchlist';
import { audiencesFor, spaceOf } from '../src/lib/announcements';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const at = (h: number) => new Date(Date.UTC(2026, 10, 7, h));

test('Caisse livreur : une seule somme (livraisons + anciens dûs + Ma caisse)', () => {
  const c = summarize(
    [{ id: 'e1', type: 'COD_COLLECTED', amount: 120.5, createdAt: at(9), orderId: 'o1' }, { id: 'e2', type: 'DUE_COLLECTED', amount: 40, createdAt: at(11), orderId: 'o2' }],
    [{ id: 'r1', amount: 30.25, collectedAt: at(10), orderId: 'o3', reference: 'LIV-1', status: 'PENDING' }, { id: 'r2', amount: 10, collectedAt: at(12), orderId: 'o4', reference: 'LIV-2', status: 'CONFIRMED' }],
  );
  assert.deepEqual([c.cod, c.dues, c.receipts, c.receiptsPending, c.total], [120.5, 40, 40.25, 30.25, 200.75]);
  assert.deepEqual(c.lines.map(l => l.id), ['e1', 'r1', 'e2', 'r2'], 'ordre chronologique');
});

test('Caisse livreur : la fin de journée, le caissier et l’écran utilisent le même calcul', () => {
  const shift = read('src/app/api/delivery/shift/route.ts');
  assert.match(shift, /driverCash\(prisma,s\.companyId,s\.id,x\.openedAt\)/);
  assert.doesNotMatch(shift, /aggregate\(\{where:\{companyId:s\.companyId,accountId:s\.id,type:\{in:\['COD_COLLECTED','DUE_COLLECTED'\]\}/, 'ancien calcul (sans Ma caisse) supprimé');
  const cashier = read('src/app/api/supplier/delivery/settlements/route.ts');
  assert.match(cashier, /supplierSettlementRemittance\.create/); assert.match(cashier, /mirrorSettlementToErp/);
  assert.match(read('src/app/api/supplier/settlements/driver/route.ts'), /Ouvrez votre journée livreur avant tout encaissement/);
  assert.match(read('src/app/api/delivery/events/route.ts'), /supplierSettlement\.aggregate/, 'pas de double encaissement COD + Ma caisse');
  assert.match(read('src/components/driver-app.tsx'), /const codToday=cashDay\?Number\(cashDay\.total\|\|0\):codCalendar/);
});

test('Reprises : code à 4 chiffres, livreur ou dépôt par l’atelier', () => {
  for (let i = 0; i < 50; i++) assert.match(newHandoverCode(), /^\d{4}$/);
  assert.equal(handoverOk('0427', '0427'), true); assert.equal(handoverOk('0427', '04 27'), true); assert.equal(handoverOk('0427', '1234'), false);
  assert.equal(handoverOk(null, ''), true, 'anciennes reprises sans code');
  assert.equal(pickupMode('SHOP_DROPOFF'), 'SHOP_DROPOFF'); assert.equal(pickupMode('x'), 'DRIVER');
  assert.equal(pickupStep({ status: 'ACCEPTED', mode: 'SHOP_DROPOFF' }), 'À déposer chez le fournisseur');
  const driver = read('src/app/api/delivery/pickups/route.ts');
  assert.match(driver, /handoverOk\(p\.handoverCode, b\.code\)/); assert.match(driver, /needsCode: !!handoverCode/);
  assert.match(read('src/app/api/supplier/return-pickups/route.ts'), /action === 'receive'/);
  assert.match(read('src/components/driver-app.tsx'), /Reprise à faire ici/);
});

test('Preuve de livraison : listes légères, preuve à la demande, code atelier caché au fournisseur', () => {
  for (const p of ['src/app/api/marketplace/orders/route.ts', 'src/app/api/supplier/orders/route.ts', 'src/app/api/delivery/orders/route.ts']) {
    const s = read(p); assert.match(s, /LIGHT_DELIVERY/, p); assert.doesNotMatch(s, /delivery:true/, p);
  }
  assert.match(read('src/lib/delivery-proof.ts'), /proofCode: undefined, codeVerified/);
  assert.match(read('src/app/api/supplier/orders/route.ts'), /deliveryCode:null,hasDeliveryCode/);
  assert.doesNotMatch(read('src/components/supplier-dashboard.tsx'), /Code remise \{o\.deliveryCode/);
  assert.match(read('src/app/supplier/statements/[id]/page.tsx'), /statement-items/);
});

test('Boutiques à surveiller', () => {
  const now = at(12).getTime(), d = (n: number) => new Date(now - n * 86400_000);
  const codes = (x: any) => watchReasons({ id: 's', repairs14d: 0, subEndsAt: null, openProblems: 0, ...x }, now).map(r => r.code);
  assert.deepEqual(codes({ createdAt: d(5), setupCompletedAt: null, lastSeenAt: d(1) }), ['NEVER_SETUP']);
  assert.deepEqual(codes({ createdAt: d(30), setupCompletedAt: d(29), lastSeenAt: d(10) }), ['INACTIVE', 'NO_REPAIRS']);
  assert.deepEqual(codes({ createdAt: d(30), setupCompletedAt: d(29), lastSeenAt: d(0), repairs14d: 4, subEndsAt: new Date(now + 3 * 86400_000), openProblems: 1 }), ['EXPIRING', 'PROBLEMS']);
  assert.deepEqual(codes({ createdAt: d(1), setupCompletedAt: null, lastSeenAt: null }), [], 'nouvelle boutique : on la laisse s’installer');
});

test('Annonces : bon espace, bon public', () => {
  assert.equal(spaceOf('/app/dashboard'), 'shop'); assert.equal(spaceOf('/supplier'), 'supplier'); assert.equal(spaceOf('/supplier/login'), null);
  assert.equal(spaceOf('/delivery/encaissements'), 'driver'); assert.equal(spaceOf('/saas'), null); assert.equal(spaceOf('/'), null);
  assert.deepEqual(audiencesFor('driver'), ['ALL', 'DRIVERS']);
});

test('Maintenance et support lecture seule : garde commune des API', () => {
  const m = read('src/lib/maintenance.ts');
  assert.match(m, /x-fixi-api/); assert.match(m, /supportRo/); assert.match(m, /status: 503/); assert.match(m, /getPlatformSession/);
  const mw = read('src/middleware.ts'); assert.match(mw, /headers\.set\('x-fixi-api', '1'\)/); assert.match(mw, /headers\.set\('x-fixi-method', req\.method\)/);
  for (const p of ['src/lib/auth.ts', 'src/lib/supplier-auth.ts', 'src/lib/delivery-auth.ts']) assert.match(read(p), /await apiGuard\(/, p);
  assert.match(read('src/app/layout.tsx'), /<MaintenanceGate\/><AnnouncementBar\/>/);
  assert.match(read('src/lib/support-access.ts'), /supportRo: true/);
  assert.match(read('src/components/legal-page.tsx'), /Nous contacter/);
});
