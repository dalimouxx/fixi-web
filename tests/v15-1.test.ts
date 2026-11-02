import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pickupStage, pickupDue, pickupMessage, readySince, daysSince, trackLink } from '../src/lib/pickup-reminders';
import { daySummary } from '../src/lib/day-summary';
import { isImei, cleanImei } from '../src/lib/imei';
import { inviteMessage, cleanPhone, cleanText, inviteCode } from '../src/lib/supplier-invite';
import { paidAmount } from '../src/lib/platform-konnect';
import { translateAr } from '../src/lib/i18n-dictionary';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

test('relance appareil prêt : 1re à 3 jours, 2e à 7, jamais en double', () => {
  assert.equal(pickupStage(2), 0); assert.equal(pickupStage(3), 1); assert.equal(pickupStage(7), 2);
  assert.equal(pickupDue(4, 0), 1); assert.equal(pickupDue(4, 1), 0); assert.equal(pickupDue(8, 1), 2); assert.equal(pickupDue(9, 2), 0);
  const now = new Date('2026-11-10T12:00:00Z');
  assert.equal(daysSince('2026-11-06T12:00:00Z', now), 4);
  assert.equal(readySince({ updatedAt: '2026-11-09', statusEvents: [{ toStatus: 'READY', createdAt: '2026-11-01' }, { toStatus: 'READY', createdAt: '2026-11-03' }] }), '2026-11-03');
  const m = pickupMessage(2, { client: 'Sami', device: 'Galaxy A54', code: 'F-1', shop: 'Fixi Gabès', balance: '130 DT', trackUrl: 'https://x/track/F-1' });
  assert.match(m, /depuis une semaine/); assert.match(m, /Reste à payer : 130 DT/); assert.match(m, /https:\/\/x\/track\/F-1/);
  assert.doesNotMatch(pickupMessage(1, { client: 'S', device: 'D', code: 'C', shop: 'X', balance: '0 DT' }), /Reste/);
  assert.match(pickupMessage(1, { client: 'S', device: 'D', code: 'C', shop: 'X' }, 'ar'), /جاهز/);
  assert.equal(trackLink('https://a.b/', 'gabes', 'F 1', 'tok'), 'https://a.b/track/F%201?shop=gabes&t=tok');
  assert.equal(trackLink('https://a.b', 'gabes', 'F1', null), '');
});

test('résumé du jour en une phrase', () => {
  assert.equal(daySummary({ ready: 3, waiting: 1, active: 5, revenue: '485 DT', pickups: 2 }), 'Aujourd’hui : 3 appareils à rendre, 2 clients à relancer, 1 pièce à recevoir et 485 DT encaissés.');
  assert.equal(daySummary({ ready: 0, waiting: 0, active: 0 }), 'Aujourd’hui : rien d’urgent, tout est à jour.');
  assert.equal(daySummary({ ready: 1, waiting: 0, active: 1 }), 'Aujourd’hui : 1 appareil à rendre.');
  assert.match(daySummary({ lang: 'ar', ready: 2, waiting: 0, active: 2 }), /^اليوم/);
});

test('IMEI : clé de Luhn et nettoyage', () => {
  assert.equal(isImei('490154203237518'), true);
  assert.equal(isImei('IMEI: 49015 4203 237518'), true);
  assert.equal(isImei('490154203237519'), false);
  assert.equal(isImei('12345'), false);
  assert.equal(cleanImei(' imei 4901-5420-3237-518 '), '490154203237518');
});

test('invitation fournisseur : message, nettoyage, code non devinable', () => {
  const m = inviteMessage({ supplier: 'Pièces Sud', shop: 'Fixi Gabès', link: 'https://x/fournisseur/abc' });
  assert.match(m, /Pièces Sud/); assert.match(m, /https:\/\/x\/fournisseur\/abc/);
  assert.equal(cleanPhone('21 555 497'), '21555497'); assert.equal(cleanPhone('12'), '');
  assert.equal(cleanText('<b>Hi</b>\n there'), 'b Hi /b there');
  assert.ok(inviteCode().length >= 8); assert.notEqual(inviteCode(), inviteCode());
});

test('paiement en ligne : seul un paiement terminé compte', () => {
  assert.equal(paidAmount({ status: 'completed', reachedAmount: 49000 }), 49);
  assert.equal(paidAmount({ status: 'pending', amount: 49000 }), 0);
  assert.equal(paidAmount(null), 0);
  const lib = read('src/lib/platform-konnect.ts');
  assert.match(lib, /platformKonnectGet\(ref\)/, 'le statut est revérifié auprès de Konnect');
  assert.match(lib, /status: SubscriptionRequestStatus\.PENDING/, 'activation une seule fois');
  assert.match(lib, /amount < price - 0\.001/, 'montant insuffisant refusé');
});

test('arabe : écrans refaits et textes avec nombres', () => {
  for (const s of ['Nouvelle pièce', 'À racheter', 'Garanties & retours', 'Devis & factures', 'Pièce compatible ?', 'Inviter mon fournisseur', 'Appareils prêts à relancer', 'Écran cassé', 'Prêt à récupérer'])
    assert.notEqual(translateAr(s), s, s);
  assert.equal(translateAr('8 j sans changement'), '8 أيام دون تغيير');
  assert.equal(translateAr('· reste 130 DT'), '· الباقي 130 DT');
  assert.equal(translateAr('Commandes actives: 5'), 'الطلبيات الجارية: 5');
});

test('écrans et routes branchés', () => {
  for (const p of ['src/app/label/[code]/page.tsx', 'src/app/fournisseur/[code]/page.tsx', 'src/app/api/supplier-invites/route.ts', 'src/app/api/subscription-center/pay/route.ts', 'src/app/api/subscription-center/konnect/route.ts', 'src/app/.well-known/assetlinks.json/route.ts', 'src/instrumentation.ts', 'android/build-twa.mjs', '.github/workflows/android-apk.yml'])
    assert.ok(fs.existsSync(path.join(root, p)), p);
  assert.match(read('src/app/api/system/automations/run/route.ts'), /pickupMessage/);
  assert.match(read('src/app/(app)/app/dashboard/page.tsx'), /fx-pickups/);
  assert.match(read('src/app/(app)/app/repairs/new/page.tsx'), /BarcodeCamera/);
  assert.match(read('src/components/repair-detail.tsx'), /\/label\//);
  assert.match(read('prisma/schema.prisma'), /model SupplierInvite/);
  assert.match(read('prisma/schema.prisma'), /pickupReminderCount Int/);
  for (const p of ['stock', 'expenses', 'warranties', 'documents', 'insights', 'compatibility'])
    assert.match(read(`src/app/(app)/app/${p}/page.tsx`), /FxSheet/, p);
});
