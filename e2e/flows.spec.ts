import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import crypto from 'node:crypto';

/** Parcours essentiels : inscription → fournisseur crée un produit (+ promo) → atelier commande → fournisseur reçoit.
 *  Puis essai Pro et double vérification de l'admin. Les données sont créées à la volée, chaque exécution est indépendante. */
const RUN = Date.now().toString(36).slice(-5);
const PLATFORM = { login: process.env.PLATFORM_ADMIN_LOGIN || 'platform', password: process.env.PLATFORM_ADMIN_PASSWORD || 'ChangeMe-Fixi-2026!' };
const SUPPLIER = { name: `Pièces Test ${RUN}`, slug: `pieces-test-${RUN}`, login: `fournisseur${RUN}`, password: 'Fournisseur-2026!' };
const PRODUCT = `Batterie Samsung A12 test ${RUN}`;
const PHONE = '2' + String(Math.floor(1e6 + Math.random() * 8e6)).padStart(7, '0');

async function fr(ctx: BrowserContext) {
  await ctx.addInitScript(() => { try { localStorage.setItem('fixi_lang', 'fr'); localStorage.setItem('fixi-tour-supplier-v1', '1'); localStorage.setItem('fixi-install-snooze-supplier', String(Date.now() + 9e9)); localStorage.setItem('fixi-ui-mode-supplier', 'advanced'); } catch {} });
}

/** TOTP RFC 6238, identique au serveur. */
function totp(secret: string, offset = 0) {
  const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = 0, value = 0; const out: number[] = [];
  for (const ch of secret.replace(/[^A-Z2-7]/g, '')) { value = (value << 5) | B32.indexOf(ch); bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000) + offset));
  const h = crypto.createHmac('sha1', Buffer.from(out)).update(msg).digest(); const o = h[h.length - 1] & 15;
  return String((((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6).padStart(6, '0');
}

test.describe.configure({ mode: 'serial' });
let atelier: Page, supplier: Page;

test('1 · un réparateur crée son compte seul (offre gratuite)', async ({ browser }) => {
  const ctx = await browser.newContext(); await fr(ctx); atelier = await ctx.newPage();
  await atelier.goto('/inscription');
  await atelier.getByPlaceholder('Ex. Phone Clinic Sousse').fill(`Atelier Robot ${RUN}`);
  await atelier.locator('select').selectOption('Gabès');
  await atelier.getByPlaceholder('Prénom et nom').fill('Robot Test');
  await atelier.getByPlaceholder('20 123 456').fill(PHONE);
  const pins = atelier.locator('input[autocomplete="new-password"]');
  await pins.nth(0).fill('482915'); await pins.nth(1).fill('482915');
  await atelier.locator('.su-accept input').check();
  await atelier.getByRole('button', { name: /Créer mon compte gratuit/ }).click();
  await expect(atelier).toHaveURL(/\/app\/suppliers/, { timeout: 30_000 });
  await expect(atelier.getByText('Premiers pas')).toBeVisible();
});

test('2 · Fixi Control crée un fournisseur', async ({ request }) => {
  const login = await request.post('/api/platform/auth/login', { data: PLATFORM });
  expect(login.ok(), await login.text()).toBeTruthy();
  const r = await request.post('/api/platform/suppliers', { data: { ...SUPPLIER, fullName: 'Gérant Robot', region: 'Gabès', verified: true } });
  expect(r.status(), await r.text()).toBe(201);
});

test('3 · le fournisseur ajoute un produit avec 3 champs et lance une promo', async ({ browser }) => {
  const ctx = await browser.newContext(); await fr(ctx); supplier = await ctx.newPage();
  await supplier.goto('/supplier/login');
  await supplier.locator('input.input').nth(0).fill(SUPPLIER.login);
  await supplier.locator('input[type=password]').fill(SUPPLIER.password);
  await supplier.getByRole('button', { name: /Se connecter/ }).click();
  await expect(supplier).toHaveURL(/\/supplier(\?|$)/);
  await supplier.goto('/supplier?tab=products');
  await supplier.locator('.ps-field--big input').fill(PRODUCT);
  await expect(supplier.locator('.ps-chips')).toContainText('Batteries');
  await supplier.locator('.ps-money input').fill('40');
  await supplier.locator('.ps-stepper input').fill('12');
  await supplier.getByRole('button', { name: /Ajouter le produit/ }).click();
  await expect(supplier.locator('.ps-note--ok')).toContainText('ajouté');
  const products = await (await supplier.request.get('/api/supplier/products')).json();
  const p = products.find((x: any) => x.name === PRODUCT);
  expect(p?.sku).toMatch(/^BAT-SAM-\d{4}$/);
  expect(p?.category).toBe('Batteries');
  const promo = await supplier.request.post('/api/supplier/promos', { data: { productId: p.id, promoPrice: 35, days: 7, notify: false } });
  expect(promo.status(), await promo.text()).toBe(201);
});

test('4 · l’atelier voit la promo et commande au prix promo', async () => {
  await atelier.goto('/app/suppliers?q=' + encodeURIComponent(PRODUCT));
  const card = atelier.locator('.market-product', { hasText: PRODUCT });
  await expect(card).toBeVisible();
  await expect(card.locator('.mk-promo-badge')).toBeVisible();
  await card.getByRole('button', { name: /Ajouter/ }).click();
  await atelier.locator('.market-cart').getByRole('button', { name: /Commander/ }).click();
  await expect(atelier.getByText(/Commande envoyée/)).toBeVisible();
  const orders = await (await atelier.request.get('/api/marketplace/orders')).json();
  const o = orders.find((x: any) => x.items.some((i: any) => i.product.name === PRODUCT));
  expect(Number(o.items[0].unitPrice)).toBe(35);
});

test('5 · le fournisseur reçoit la commande', async () => {
  const orders = await (await supplier.request.get('/api/supplier/orders')).json();
  expect(orders.some((o: any) => o.items.some((i: any) => i.product.name === PRODUCT) && o.status === 'PENDING')).toBeTruthy();
});

test('6 · le module Réparations propose l’essai Pro, qui s’active en un clic', async () => {
  await atelier.goto('/app/repairs');
  await expect(atelier).toHaveURL(/\/app\/upgrade\?from=%2Fapp%2Frepairs/);
  await expect(atelier.getByText(/fait partie de Fixi Pro/)).toBeVisible();
  await atelier.getByRole('button', { name: /Essayer Fixi Pro \d+ jours/ }).click();
  await expect(atelier).not.toHaveURL(/\/app\/upgrade/, { timeout: 30_000 });
  const r = await atelier.request.get('/api/subscription/trial');
  expect((await r.json()).eligible).toBe(false); // un seul essai par atelier
});

test('7 · double vérification de l’admin : le code est exigé à la connexion', async ({ browser }) => {
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  expect((await page.request.post('/api/platform/auth/login', { data: PLATFORM })).ok()).toBeTruthy();
  const setup = await (await page.request.post('/api/platform/security', { data: { action: 'setup' } })).json();
  expect(setup.secret).toMatch(/^[A-Z2-7]{32}$/);
  const on = await page.request.post('/api/platform/security', { data: { action: 'enable', code: totp(setup.secret) } });
  expect(on.ok(), await on.text()).toBeTruthy();
  // La session courante est fermée et un nouvel appareil doit fournir le code.
  expect((await page.request.get('/api/platform/growth')).status()).toBe(401);
  const fresh = await browser.newContext();
  const noCode = await fresh.request.post('/api/platform/auth/login', { data: PLATFORM });
  expect(noCode.status()).toBe(401); expect((await noCode.json()).needsTotp).toBe(true);
  const ok = await fresh.request.post('/api/platform/auth/login', { data: { ...PLATFORM, totp: totp(setup.secret) } });
  expect(ok.ok(), await ok.text()).toBeTruthy();
  const growth = await fresh.request.get('/api/platform/growth');
  expect(growth.ok(), await growth.text()).toBeTruthy();
  expect((await growth.json()).kpis.signups30).toBeGreaterThanOrEqual(1);
  // Remet l'admin dans l'état initial pour les exécutions suivantes.
  expect((await fresh.request.post('/api/platform/security', { data: { action: 'disable', code: totp(setup.secret) } })).ok()).toBeTruthy();
});
