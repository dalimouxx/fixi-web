import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { translateAr } from '../src/lib/i18n-dictionary';
import { hashWidgetToken, newWidgetToken } from '../src/lib/widget-token';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

test('dates françaises traduites en arabe tunisien', () => {
  assert.equal(translateAr('2 nov. 2026'), '2 نوفمبر 2026');
  assert.equal(translateAr('lundi 2 novembre'), 'الإثنين 2 نوفمبر');
  assert.equal(translateAr('jusqu’au 14 juil. 2026'), 'إلى غاية 14 جويلية 2026');
  assert.equal(translateAr('mai'), 'mai', 'un mot seul n’est pas une date');
  assert.equal(translateAr('Il manque 3 DT.'), 'ينقص 3 DT.');
});

test('jeton du widget : aléatoire, stocké haché, résumé sans données client', () => {
  const t = newWidgetToken();
  assert.ok(t.length >= 40); assert.notEqual(t, newWidgetToken());
  assert.match(hashWidgetToken(t), /^[0-9a-f]{64}$/); assert.notEqual(hashWidgetToken(t), t);
  const api = read('src/app/api/widget/summary/route.ts');
  assert.doesNotMatch(api, /fullName|phone:|\.phone/, 'aucun nom ni téléphone dans le résumé');
  assert.match(api, /revokedAt/); assert.match(api, /isActive: true/);
});

test('widget Android natif branché sur la compilation', () => {
  for (const p of ['android/patch-widget.mjs', 'android/widget/java/FixiWidgetProvider.java', 'android/widget/java/WidgetSetupActivity.java', 'android/widget/res/xml/fixi_widget_info.xml'])
    assert.ok(fs.existsSync(path.join(root, p)), p);
  assert.match(read('.github/workflows/android-apk.yml'), /patch-widget\.mjs/);
  assert.match(read('android/widget/java/WidgetSetupActivity.java'), /\[A-Za-z0-9_-\]\{20,100\}/);
  assert.match(read('android/widget/java/FixiWidgetProvider.java'), /R\.string\.hostName/, 'le widget ne parle qu’au site de l’application');
});

test('écrans atelier refaits', () => {
  for (const p of ['clients', 'appointments', 'cash-sessions', 'purchases', 'team']) assert.match(read(`src/app/(app)/app/${p}/page.tsx`), /fx-page/, p);
  for (const p of ['cash-sessions', 'purchases', 'team']) assert.match(read(`src/app/(app)/app/${p}/page.tsx`), /FxSheet/, p);
});
