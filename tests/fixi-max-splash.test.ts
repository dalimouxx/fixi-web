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

test('Tableau de bord Fixi Max : chiffres animés, courbe, anneau, données et permissions conservées', () => {
  const page = readFileSync('src/app/(app)/app/dashboard/page.tsx', 'utf8');
  assert.ok(page.includes('className="fx-page fxm-dash"'));
  assert.ok(page.includes('function CountUp') && page.includes('function Sparkline') && page.includes('function Ring'));
  assert.ok(page.includes("useApi<any>('/api/dashboard')"));
  assert.ok(page.includes('perm.finance &&') && page.includes('perm.profit'));
  assert.ok(page.includes('<FixiLoader'));
  assert.ok(page.includes('prefers-reduced-motion: reduce'));
});

test('Réparations Fixi Max : liste + aperçu latéral, kanban, filtres et fonctions conservées', () => {
  const page = readFileSync('src/app/(app)/app/repairs/page.tsx', 'utf8');
  assert.ok(page.includes('className="page fxm-rp"'));
  assert.ok(page.includes('fxm-drawer') && page.includes('Ouvrir la fiche complète'));
  assert.ok(page.includes('fxm-kanban') && page.includes("move(r.code,cols[ci+1][0])"));
  assert.ok(page.includes("['stale','Bloqués 3 j+'") && page.includes("['due','Solde à encaisser'"));
  assert.ok(page.includes('SwipeCard'), 'cartes à glisser sur mobile conservées');
  assert.ok(page.includes('/app/cashier?repair='));
});

test('Réception Fixi Max : étapes, aperçu du ticket, fonctions conservées', () => {
  const page = readFileSync('src/app/(app)/app/repairs/new/page.tsx', 'utf8');
  assert.ok(page.includes('fxm-rx-steps') && page.includes('Aperçu du ticket'));
  for (const k of ['VoiceReceptionCopilot', 'queueOfflineRepair', 'uploadIntakePhotos', 'BarcodeCamera', '/api/imei/check', '/api/network/price-hint']) assert.ok(page.includes(k), k);
});

test('Caisse Fixi Max : encaissement, livraison, monnaie à rendre et écran de succès', () => {
  const page = readFileSync('src/app/(app)/app/cashier/page.tsx', 'utf8');
  assert.ok(page.includes("api('/api/cashier/checkout'") && page.includes("status: 'DELIVERED'"));
  assert.ok(page.includes('Monnaie à rendre') && page.includes('fxm-cash-success'));
  assert.ok(page.includes("get('repair')"), 'ouverture directe depuis une réparation');
});
