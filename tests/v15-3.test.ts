import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { atelierWidget, supplierWidget, driverWidget } from '../src/lib/widget-summary';
import { widgetIntentUrl } from '../src/components/android-widget-button';
import { apkShareMessage, APK_URL } from '../src/lib/apk';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

test('widget : 3 cases et une ligne de bas pour chaque espace', () => {
  const a = atelierWidget({ shop: 'Fixi Gabès', ready: 3, inRepair: 5, waitingPart: 1, toRemind: 2, revenueToday: 485 });
  assert.deepEqual(a.cells.map(c => c.label), ['Prêts', 'En cours', 'Attente pièce']);
  assert.deepEqual(a.cells.map(c => c.value), [3, 5, 1]);
  assert.equal(a.foot, '2 clients à relancer · 485 DT aujourd’hui');
  assert.equal(a.firstCellPath, '/app/cashier');
  assert.equal(atelierWidget({ shop: 'X', ready: 0, inRepair: 0, waitingPart: 0, toRemind: 0, revenueToday: null }).foot, 'Rien d’urgent');
  const s = supplierWidget({ company: 'Pièces Sud', pending: 2, preparing: 3, ready: 1, onRoad: 4, deliveredToday: 6 });
  assert.deepEqual(s.cells.map(c => c.label), ['À confirmer', 'À préparer', 'Prêtes']);
  assert.equal(s.foot, '4 en livraison · 6 livrées aujourd’hui');
  const d = driverWidget({ company: 'Pièces Sud', mine: 2, available: 1, deliveredToday: 3, cashToday: 120.5 }, 'ar');
  assert.equal(d.cells[0].label, 'مهامي'); assert.equal(d.openPath, '/delivery');
});

test('liaison du widget : lien « intent » vers l’application, jeton encodé', () => {
  const u = widgetIntentUrl('abc_DEF-123456789012345', 'ar');
  assert.equal(u, 'intent://widget?token=abc_DEF-123456789012345&lang=ar#Intent;scheme=fixiapp;package=tn.fixi.app;end');
  assert.match(widgetIntentUrl('x y', 'fr'), /token=x%20y&lang=fr/);
  assert.match(read('android/widget/java/FixiWidgetProvider.java'), /fixi_widget_small/, 'petite taille prévue');
  assert.match(read('android/widget/java/FixiWidgetProvider.java'), /optJSONArray\("cells"\)/);
  assert.match(read('src/app/api/widget/summary/route.ts'), /SUPPLIER/);
  assert.match(read('src/app/api/widget/summary/route.ts'), /DRIVER/);
});

test('téléchargement direct de l’APK', () => {
  assert.match(APK_URL, /releases\/download\/android-latest\/Fixi\.apk$/);
  const m = apkShareMessage('https://fixi.tn/', 'Fixi Gabès');
  assert.match(m, /https:\/\/fixi\.tn\/android/); assert.match(m, /Installer/);
  assert.match(read('.github/workflows/android-apk.yml'), /gh release create android-latest/);
  assert.match(read('.github/workflows/android-apk.yml'), /branches: \[main\]/);
  assert.ok(fs.existsSync(path.join(root, 'src/app/android/page.tsx')));
  assert.ok(fs.existsSync(path.join(root, 'src/app/telecharger/android/route.ts')));
  assert.match(read('src/components/install-prompt.tsx'), /href="\/android"/);
});
