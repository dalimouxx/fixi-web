import test from 'node:test';
import assert from 'node:assert/strict';
import { atelierNav, visibleNav, matchNav, itemLabel } from '../src/lib/nav-atelier';
import { humanError } from '../src/lib/human-error';
import { waPhone, waLink, waTemplate } from '../src/lib/whatsapp-link';
import { helpFor } from '../src/lib/help-content';

// Tous les écrans de l'ancien menu (38 entrées) doivent garder une place dans le nouveau.
const legacyRoutes = ['/app/dashboard', '/app/repairs/new', '/app/repairs', '/app/clients', '/app/cashier', '/app/stock',
  '/app/compatibility', '/app/device-catalog', '/app/suppliers', '/app/mes-dettes', '/app/purchases', '/app/parts-market',
  '/app/appointments', '/app/warranties', '/app/documents', '/app/payments', '/app/cash-sessions', '/app/stock-movements',
  '/app/expenses', '/app/brain', '/app/insights', '/app/automations', '/app/marketing', '/app/owner', '/app/network',
  '/app/community', '/app/expert-call', '/app/academy', '/app/care', '/app/offline', '/app/team', '/app/reports',
  '/app/support', '/app/updates', '/app/referrals', '/app/subscription', '/app/audit', '/app/settings'];

test('le menu Atelier tient en 7 entrées', () => {
  assert.equal(atelierNav.length, 7);
});

test('chaque ancien écran a exactement une place dans le nouveau menu', () => {
  const hrefs = atelierNav.flatMap(s => s.items.map(i => i.href));
  for (const r of legacyRoutes) assert.equal(hrefs.filter(h => h === r).length, 1, r);
});

test('le Mode Simple masque les modules avancés, le Mode Avancé les montre', () => {
  const simple = visibleNav('ADMIN', { includeAdvanced: false }).flatMap(s => s.items.map(i => i.href));
  const full = visibleNav('ADMIN', { includeAdvanced: true }).flatMap(s => s.items.map(i => i.href));
  assert.ok(!simple.includes('/app/brain'));
  assert.ok(full.includes('/app/brain'));
  assert.ok(simple.length < full.length);
});

test('le technicien ne voit ni la caisse ni les clients', () => {
  const ids = visibleNav('TECHNICIAN', { includeAdvanced: false }).map(s => s.id);
  assert.ok(!ids.includes('cash'));
  assert.ok(!ids.includes('clients'));
  const repairs = visibleNav('TECHNICIAN', { includeAdvanced: false }).find(s => s.id === 'repairs')!;
  assert.equal(itemLabel(repairs.items.find(i => i.href === '/app/repairs')!, 'TECHNICIAN'), 'Mes réparations');
});

test('Fixi Connect ne garde que les écrans autorisés', () => {
  const allowed = new Set(['/app/suppliers', '/app/mes-dettes', '/app/support', '/app/subscription']);
  const items = visibleNav('ADMIN', { includeAdvanced: true, allow: h => allowed.has(h) }).flatMap(s => s.items.map(i => i.href));
  assert.deepEqual(new Set(items), allowed);
});

test("l'URL courante active l'entrée la plus précise", () => {
  const sections = visibleNav('ADMIN', { includeAdvanced: true });
  assert.equal(matchNav('/app/repairs/new', sections)?.item.href, '/app/repairs/new');
  assert.equal(matchNav('/app/repairs/F-2612345', sections)?.item.href, '/app/repairs');
  assert.equal(matchNav('/app/inconnu', sections), null);
});

test('les codes techniques deviennent des phrases', () => {
  assert.match(humanError('MODULE_PREMIUM_REQUIS'), /Fixi Pro/);
  assert.match(humanError(new Error('UNAUTHENTICATED')), /session/);
  assert.match(humanError('Failed to fetch'), /internet/);
  assert.match(humanError('Invalid `prisma.repair.create()` invocation'), /Réessayez/);
  assert.equal(humanError('Stock insuffisant'), 'Stock insuffisant');
});

test('les numéros tunisiens sont prêts pour WhatsApp', () => {
  assert.equal(waPhone('21 555 497'), '21621555497');
  assert.equal(waPhone('+216 21 555 497'), '21621555497');
  assert.equal(waPhone('0021621555497'), '21621555497');
  assert.equal(waPhone(''), '');
  assert.ok(waLink('21555497', 'Bonjour').startsWith('https://wa.me/21621555497?text=Bonjour'));
});

test('les modèles WhatsApp existent en français et en arabe', () => {
  const v = { client: 'Sami', device: 'Galaxy A54', code: 'F-1', balance: '130 DT', shop: 'Fixi' };
  assert.match(waTemplate('ready', v, 'fr'), /prêt/);
  assert.match(waTemplate('ready', v, 'ar'), /جاهز/);
});

test("l'aide contextuelle couvre les écrans principaux et a une page par défaut", () => {
  assert.equal(helpFor('/app/repairs/new').title.fr, 'Nouvelle réparation');
  assert.equal(helpFor('/app/repairs/F-2612345').title.fr, 'Fiche réparation');
  assert.equal(helpFor('/app/inconnu').title.fr, 'Aide');
});

test('aucun code brut à l’écran : moyens de paiement, statuts et actions en français', async () => {
  const { payLabel, statusLabel, actionLabel, entityLabel, humanize } = await import('../src/lib/labels');
  assert.equal(payLabel('CASH'), 'Espèces');
  assert.equal(payLabel('bank_transfer'), 'Virement');
  assert.equal(statusLabel('OUT_FOR_DELIVERY'), 'En livraison');
  assert.equal(actionLabel('REMOVE_PART'), 'Pièce retirée');
  assert.equal(entityLabel('SUPPLIER'), 'Fournisseur');
  assert.equal(humanize('NEW_THING'), 'New thing');
  assert.equal(humanize(''), '—');
});

test('Fixi Control et les documents imprimables restent en clair', async () => {
  const { isLightOnly } = await import('../src/lib/theme-scope');
  assert.ok(isLightOnly('/saas'));
  assert.ok(isLightOnly('/saas/suppliers'));
  assert.ok(isLightOnly('/supplier/daily-report'));
  assert.ok(!isLightOnly('/supplier'));
  assert.ok(!isLightOnly('/app/dashboard'));
  assert.ok(!isLightOnly('/saasx'));
});

test('le menu atelier : Gestion et Aide séparés, rien de plus de 12 entrées', () => {
  const full = visibleNav('ADMIN', { includeAdvanced: true });
  for (const s of full) assert.ok(s.items.length <= 12, s.id);
  assert.deepEqual(full.map(s => s.label), ['Accueil', 'Réparations', 'Clients', 'Caisse', 'Pièces', 'Gestion', 'Aide']);
});
