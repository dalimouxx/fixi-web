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
  const charts = readFileSync('src/components/fixi-max-charts.tsx', 'utf8');
  assert.ok(charts.includes('export function CountUp') && charts.includes('export function Sparkline') && charts.includes('export function Ring'));
  assert.ok(page.includes("from '@/components/fixi-max-charts'"));
  assert.ok(page.includes("useApi<any>('/api/dashboard')"));
  assert.ok(page.includes('perm.finance &&') && page.includes('perm.profit'));
  assert.ok(page.includes('<FixiLoader'));
  assert.ok(charts.includes('prefers-reduced-motion: reduce'));
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

test('Accueil fournisseur Fixi Max : ventes du jour, recouvrement, commandes en direct, mode Avancé conservé', () => {
  const home = readFileSync('src/components/supplier-home.tsx', 'utf8');
  for (const k of ['Ventes du jour', 'À recouvrer', 'Commandes en direct', 'Produits stars', 'À traiter maintenant']) assert.ok(home.includes(k), k);
  assert.ok(home.includes('Number(x.total || 0) - Number(x.paid || 0)'), 'reste dû = total − payé');
  const dash = readFileSync('src/components/supplier-dashboard.tsx', 'utf8');
  assert.ok(dash.includes('<SupplierHome') && dash.includes('{advancedMode&&<div style={{marginTop:24}}>'));
  assert.ok(dash.includes('<FixiSmartWidgets area="supplier"'));
});

test('Commandes fournisseur Fixi Max : colonnes par défaut, logique conservée', () => {
  const dash = readFileSync('src/components/supplier-dashboard.tsx', 'utf8');
  assert.ok(dash.includes("setBoard(localStorage.getItem('fixi-supplier-board')!=='0')"), 'colonnes par défaut, choix « Liste » respecté');
  assert.ok(dash.includes('className="supplier-panel fxm-so"'));
  for (const k of ['onDrop=', 'setPickFor(o)', "status(o.id,'CANCELLED')", 'Affecter un livreur']) assert.ok(dash.includes(k), k);
  assert.match(css, /\.fxm-so \.fx-order-col\[data-drop\]/);
});

test('Habillage commun Fixi Max : variables --fx-* rebranchées, barre fournisseur animée', () => {
  assert.match(css, /:is\(\.fxm-shell, \.supplier-os\) \{\s*--fx-bg: var\(--fxm-bg\);/);
  assert.match(css, /html\[data-theme='dark'\] :is\(\.fxm-shell, \.supplier-os\) \{/);
  const dash = readFileSync('src/components/supplier-dashboard.tsx', 'utf8');
  assert.ok(dash.includes('<FixiAnimatedLogo size={42}/>') && dash.includes('supplier-os supplier-erp fxm-sup'));
  const globals = readFileSync('src/app/globals.css', 'utf8');
  assert.ok(globals.includes('@layer fxm-force, fx-force, legacy;'));
});

test('Livreur et suivi client Fixi Max : clair par défaut, couleur de la boutique conservée', () => {
  assert.match(css, /html:not\(\[data-theme='dark'\]\) \.delivery-app\.driver-v3 \.dv-hero \{/);
  assert.match(css, /\.fx-track \{[^}]*--fx-bg: var\(--fxm-bg\)/);
  assert.match(css, /\.fx-track[^{]*\{[^}]*var\(--shop-brand-soft\)/);
});
