import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Caisse Windows Fixi Max : logo animé, habillage clair par défaut, thème appliqué partout', () => {
  const brand = readFileSync('apps/windows-pos/src/brand.tsx', 'utf8');
  assert.ok(brand.includes('fxm-logo') && brand.includes('fxm-logo-core'));
  const pos = readFileSync('apps/windows-pos/src/CaisseV4.tsx', 'utf8');
  assert.ok(pos.includes("import './fixi-max.css';") && pos.indexOf("import './fixi-max.css';") > pos.indexOf("import './v5.css';"));
  assert.ok(pos.includes('document.documentElement.dataset.theme=t===\'dark\''), 'thème appliqué avant le rendu (atelier compris)');
  assert.ok(readFileSync('apps/windows-pos/src/storage.ts', 'utf8').includes("theme:'light'"));
  const pcss = readFileSync('apps/windows-pos/src/fixi-max.css', 'utf8');
  assert.match(pcss, /:root\[data-theme=dark\]\{/);
  assert.match(pcss, /prefers-reduced-motion:reduce/);
});
