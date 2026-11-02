import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { repairAge } from '../src/lib/repair-age';
import { quickIssues } from '../src/lib/common-issues';
import { repairSteps } from '../src/lib/repair-steps';
import { shopBrandVars, onColor, isHexColor, contrast, SHOP_COLOR_PRESETS } from '../src/lib/brand-color';
import { isMutation } from '../src/lib/haptics';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');
const now = new Date('2026-11-10T12:00:00Z');
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();

test('ancienneté : orange à 3 jours, rouge à 7, rien pour les appareils rendus', () => {
  assert.equal(repairAge({ status: 'IN_REPAIR', updatedAt: daysAgo(1) }, now).level, 'ok');
  assert.equal(repairAge({ status: 'IN_REPAIR', updatedAt: daysAgo(3) }, now).level, 'warn');
  assert.equal(repairAge({ status: 'WAITING_PART', updatedAt: daysAgo(8) }, now).level, 'late');
  assert.equal(repairAge({ status: 'WAITING_PART', updatedAt: daysAgo(8) }, now).label, '8 j sans changement');
  assert.equal(repairAge({ status: 'DELIVERED', updatedAt: daysAgo(30) }, now).level, 'ok');
  assert.equal(repairAge({ status: 'RECEIVED', createdAt: daysAgo(4) }, now).level, 'warn');
});

test('pannes en un toucher : liste commune + prix de l’atelier + pannes propres', () => {
  const types = [
    { id: 't1', name: 'Écran cassé', category: 'PHONE', fixedPrice: '120', isFixedPrice: true },
    { id: 't2', name: 'Désoxydation premium', category: 'PHONE', fixedPrice: null },
    { id: 't3', name: 'Écran', category: 'LAPTOP', fixedPrice: '300' },
  ];
  const q = quickIssues(types, 'PHONE');
  assert.equal(q[0].name, 'Écran cassé');
  assert.equal(q[0].price, 120);
  assert.ok(q.some(x => x.name === 'Désoxydation premium'));
  assert.ok(q.length <= 10);
  assert.equal(quickIssues(null, 'PHONE')[1].name, 'Batterie');
  assert.equal(quickIssues(types, 'LAPTOP')[0].price, 300);
  assert.ok(quickIssues([], 'OTHER').length > 0, 'catégorie inconnue → liste téléphone');
});

test('frise : étape actuelle, attente pièce seulement si utilisée', () => {
  const s = repairSteps('IN_REPAIR');
  assert.deepEqual(s.map(x => x.key), ['RECEIVED', 'DIAGNOSIS', 'IN_REPAIR', 'READY', 'DELIVERED']);
  assert.deepEqual(s.map(x => x.state), ['done', 'done', 'current', 'todo', 'todo']);
  const w = repairSteps('WAITING_PART');
  assert.equal(w.find(x => x.key === 'WAITING_PART')?.state, 'current');
  const back = repairSteps('IN_REPAIR', [{ toStatus: 'WAITING_PART', createdAt: daysAgo(2) }]);
  assert.equal(back.find(x => x.key === 'WAITING_PART')?.state, 'done');
  assert.equal(back.find(x => x.key === 'IN_REPAIR')?.state, 'current');
  assert.ok(repairSteps('CANCELLED').every(x => x.state !== 'current'));
});

test('couleur de l’atelier : texte lisible, repli sur l’orange Fixi', () => {
  assert.equal(shopBrandVars(null)['--shop-brand'], '#c2500a');
  assert.equal(shopBrandVars('javascript:alert(1)')['--shop-brand'], '#c2500a');
  assert.equal(shopBrandVars('#1570EF')['--shop-brand'], '#1570ef');
  assert.equal(onColor('#ffe066'), '#101828');
  assert.equal(onColor('#344054'), '#ffffff');
  for (const c of SHOP_COLOR_PRESETS) { assert.ok(isHexColor(c)); assert.ok(contrast(c, onColor(c)) >= 3, c); }
});

test('vibration seulement pour les actions qui modifient', () => {
  assert.equal(isMutation(), false);
  assert.equal(isMutation({ method: 'get' }), false);
  assert.equal(isMutation({ method: 'PATCH' }), true);
});

test('écrans branchés : bouton +, visite, glisser, colonnes, suivi client', () => {
  assert.match(read('src/components/app-shell.tsx'), /fx-tab-fab/);
  assert.match(read('src/components/app-shell.tsx'), /GuidedTour space="atelier"/);
  assert.match(read('src/components/supplier-dashboard.tsx'), /GuidedTour space="supplier"/);
  assert.match(read('src/components/supplier-dashboard.tsx'), /fx-order-board/);
  assert.match(read('src/app/(app)/app/repairs/page.tsx'), /<SwipeCard/);
  assert.match(read('src/app/(app)/app/repairs/new/page.tsx'), /uploadIntakePhotos/);
  assert.match(read('src/app/track/[code]/page.tsx'), /openGraph/);
  assert.match(read('src/app/api/settings/route.ts'), /'brandColor'/);
  assert.match(read('src/components/ui.tsx'), /haptic\('success'\)/);
  assert.match(read('prisma/schema.prisma'), /brandColor\s+String\?/);
});
