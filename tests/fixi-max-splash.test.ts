import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync('src/app/fixi-max.css', 'utf8');
const layout = readFileSync('src/app/layout.tsx', 'utf8');
const splash = readFileSync('src/components/fixi-splash.tsx', 'utf8');

test('Fixi Max : clair par défaut, sombre via data-theme', () => {
  assert.match(css, /:root\s*{[^}]*--fxm-bg:\s*#f6f3f9/);
  assert.match(css, /html\[data-theme='dark'\]\s*{[^}]*--fxm-bg:\s*#08070c/);
});

test('Logo animé : écran d’ouverture branché dans le layout racine', () => {
  assert.ok(layout.includes("import './fixi-max.css'"));
  assert.ok(layout.includes('<FixiSplash/>'));
  assert.ok(layout.includes('FIXI_SPLASH_HEAD_SCRIPT'));
});

test('Écran d’ouverture : une fois par session et jamais avec « réduire les animations »', () => {
  assert.ok(splash.includes("sessionStorage.getItem('fixi-splash-seen')"));
  assert.ok(splash.includes('prefers-reduced-motion: reduce'));
  assert.match(css, /html:not\(\[data-splash='1'\]\) \.fxm-splash\s*{\s*display:\s*none/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test('Chargement animé sur les espaces atelier, fournisseur et livreur', () => {
  for (const p of ['src/app/(app)/app/loading.tsx', 'src/app/supplier/loading.tsx', 'src/app/delivery/loading.tsx']) {
    assert.ok(readFileSync(p, 'utf8').includes('<FixiLoader'), p);
  }
});

test('Barre latérale Fixi Max : logo animé, groupes, abonnement, thème dans l’en-tête', () => {
  const shell = readFileSync('src/components/app-shell.tsx', 'utf8');
  assert.ok(shell.includes('fx-shell fxm-shell'));
  assert.ok(shell.includes('<FixiBrand'));
  assert.ok(shell.includes("home: 'Atelier'") && shell.includes("cash: 'Commerce'"));
  assert.ok(shell.includes('className="fxm-plan"'));
  assert.ok(shell.includes('<span className="fxm-top-theme"><ThemeToggle /></span>'));
  assert.match(css, /html\[data-theme='dark'\] \.fxm-shell \.fx-side\s*{/);
});
