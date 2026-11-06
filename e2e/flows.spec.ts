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
let orderId = '';

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
  // Mode « Guidé » par défaut (Fixi Max) : création de 2 variantes en un clic.
  await expect(supplier.locator('.fxm-gp')).toBeVisible();
  const rowsGp = supplier.locator('.fxm-gp-row:not(.fxm-gp-row--head)');
  await expect(rowsGp).toHaveCount(2);
  await rowsGp.nth(0).locator('input').nth(0).fill('110');
  await expect(rowsGp.nth(0).locator('input').nth(1)).toHaveValue('143');
  await rowsGp.nth(1).locator('input').nth(0).fill('60');
  await supplier.getByRole('button', { name: /Créer 2 variantes/ }).click();
  await expect(supplier.locator('.fxm-gp-result.ok')).toContainText('Écran iPhone 13 OLED créé', { timeout: 15_000 });
  // Mode « Rapide » toujours disponible.
  await supplier.getByRole('tab', { name: /Rapide/ }).click();
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
  orderId = o.id;
});

test('5 · le fournisseur reçoit la commande', async () => {
  const orders = await (await supplier.request.get('/api/supplier/orders')).json();
  expect(orders.some((o: any) => o.items.some((i: any) => i.product.name === PRODUCT) && o.status === 'PENDING')).toBeTruthy();
});

test('5b · retour en stock : l’atelier qui attend une pièce est prévenu', async () => {
  const name = `Écran Oppo A16 test ${RUN}`;
  const created = await supplier.request.post('/api/supplier/products', { data: { name, price: 70, stock: 0 } });
  expect(created.status(), await created.text()).toBe(201);
  const p = await created.json();
  expect((await atelier.request.post('/api/marketplace/stock-alerts', { data: { productId: p.id } })).status()).toBe(201);
  expect(await (await atelier.request.get('/api/marketplace/stock-alerts')).json()).toContain(p.id);
  const restock = await supplier.request.post('/api/supplier/products/bulk', { data: { rows: [{ sku: p.sku, name, price: 70, stock: 5 }] } });
  expect((await restock.json()).updated).toBe(1);
  await expect.poll(async () => { await atelier.request.get('/api/marketplace/products?q=' + encodeURIComponent(name)); return (await (await atelier.request.get('/api/marketplace/stock-alerts')).json()).includes(p.id); }, { timeout: 60_000, intervals: [5_000] }).toBe(false);
  const rem = await supplier.request.get('/api/supplier/reminders');
  expect(rem.ok(), await rem.text()).toBeTruthy();
  expect(Array.isArray((await rem.json()).rows)).toBe(true);
});

test('5c · pièce introuvable : demande, offre du fournisseur, choix de l’atelier', async () => {
  const ask = await atelier.request.post('/api/marketplace/part-requests', { data: { partName: `Nappe test ${RUN}`, deviceModel: 'Redmi Note 13', quantity: 2, scope: 'ALL' } });
  expect(ask.status(), await ask.text()).toBe(201);
  const req = await ask.json();
  const list = await (await supplier.request.get('/api/supplier/part-requests')).json();
  expect(list.some((r: any) => r.id === req.id)).toBe(true);
  const quote = await supplier.request.post('/api/supplier/part-requests', { data: { requestId: req.id, price: 55, quantity: 2, delay: 'H24' } });
  expect(quote.status(), await quote.text()).toBe(201);
  const mine = await (await atelier.request.get('/api/marketplace/part-requests')).json();
  const q = mine.find((r: any) => r.id === req.id).quotes[0];
  expect(Number(q.price)).toBe(55);
  const acc = await atelier.request.patch('/api/marketplace/part-requests', { data: { id: req.id, quoteId: q.id } });
  expect((await acc.json()).productId).toBe(q.productId);
  for (const path of ['/api/supplier/churn', '/api/supplier/cash-forecast']) { const r = await supplier.request.get(path); expect(r.ok(), path + ' ' + await r.text()).toBeTruthy(); }
});

test('5d · performance livreurs et prime', async () => {
  const set = await supplier.request.patch('/api/supplier/driver-stats', { data: { bonusPerDelivery: 1.5 } });
  expect(set.ok(), await set.text()).toBeTruthy();
  const r = await supplier.request.get('/api/supplier/driver-stats?days=7');
  expect(r.ok()).toBeTruthy(); expect((await r.json()).bonusPerDelivery).toBe(1.5);
  const p = await supplier.request.get('/api/supplier/return-pickups'); expect(p.ok(), await p.text()).toBeTruthy();
});

test('5e · livreurs partenaires : réservé à l’abonnement actif (pas pendant l’essai)', async () => {
  const g = await supplier.request.get('/api/supplier/partner-couriers');
  expect(g.ok(), await g.text()).toBeTruthy(); expect((await g.json()).allowed).toBe(false);
  expect((await supplier.request.post('/api/supplier/partner-couriers', { data: { orderId: 'x', driverId: 'y' } })).status()).toBe(403);
});

test('5f · livraison complète : préparation, livreur, arrivée, code, signature, puis reprise et avoir', async ({ browser }) => {
  const drv = { fullName: 'Livreur Robot', login: `livreur${RUN}`, password: 'Livreur-2026!', phone: '98' + RUN.replace(/\D/g, '').padEnd(6, '1').slice(0, 6) };
  const created = await supplier.request.post('/api/supplier/drivers', { data: drv });
  expect(created.status(), await created.text()).toBeLessThan(300);
  const driverId = (await created.json()).id || (await created.json()).account?.id;
  for (const status of ['CONFIRMED', 'PREPARING', 'READY_FOR_DELIVERY']) { const r = await supplier.request.patch('/api/supplier/orders/' + orderId, { data: { status } }); expect(r.ok(), status + ' ' + await r.text()).toBeTruthy(); }
  const drivers = await (await supplier.request.get('/api/supplier/return-pickups')).json();
  const did = driverId || drivers.drivers.find((d: any) => d.fullName === drv.fullName)?.id;
  const assign = await supplier.request.post('/api/supplier/delivery/assign', { data: { orderId, driverAccountId: did } });
  expect(assign.ok(), await assign.text()).toBeTruthy();
  const dctx = await browser.newContext(); const d = dctx.request;
  expect((await d.post('/api/delivery/auth/login', { data: { login: drv.login, password: drv.password } })).ok()).toBeTruthy();
  expect((await d.post('/api/delivery/shift', { data: { action: 'OPEN', startCash: 0 } })).ok()).toBeTruthy();
  const out = await d.patch('/api/delivery/orders/' + orderId, { data: { status: 'OUT_FOR_DELIVERY' } }); expect(out.ok(), await out.text()).toBeTruthy();
  expect((await d.post('/api/delivery/events', { data: { orderId, type: 'ARRIVED_AT_SHOP' } })).ok()).toBeTruthy();
  const mine = (await (await atelier.request.get('/api/marketplace/orders')).json()).find((x: any) => x.id === orderId);
  expect((await d.patch('/api/delivery/orders/' + orderId, { data: { status: 'DELIVERED', recipientName: 'Robot', proofCode: '000000' } })).status()).toBe(409);
  const sig = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  const ok = await d.patch('/api/delivery/orders/' + orderId, { data: { status: 'DELIVERED', recipientName: 'Robot', proofCode: mine.deliveryCode, signatureUrl: sig } });
  expect(ok.ok(), await ok.text()).toBeTruthy();
  const after = (await (await atelier.request.get('/api/marketplace/orders')).json()).find((x: any) => x.id === orderId);
  expect(after.status).toBe('DELIVERED'); expect(after.delivery.signatureUrl).toBe(sig);
  // Reprise d'une pièce défectueuse pendant la tournée, puis avoir.
  const ret = await atelier.request.post('/api/marketplace/returns', { data: { orderId, items: [{ itemId: after.items[0].id, quantity: 1 }], reason: 'DEFECTIVE' } });
  expect(ret.status(), await ret.text()).toBe(201);
  const pick = await ret.json();
  expect((await supplier.request.patch('/api/supplier/return-pickups', { data: { id: pick.id, action: 'accept', driverAccountId: did } })).ok()).toBeTruthy();
  const todo = await (await d.get('/api/delivery/pickups')).json(); expect(todo.some((x: any) => x.id === pick.id)).toBe(true);
  expect((await d.patch('/api/delivery/pickups', { data: { id: pick.id } })).ok()).toBeTruthy();
  const p2 = (await (await supplier.request.get('/api/supplier/return-pickups')).json()).rows.find((x: any) => x.id === pick.id);
  expect(p2.status).toBe('COLLECTED');
  if (p2.saleId) {
    const av = await supplier.request.post('/api/supplier/advanced', { data: { action: 'RETURN', type: 'SALE_RETURN', sourceSaleId: p2.saleId, refund: 0, items: p2.items.filter((i: any) => i.saleItemId).map((i: any) => ({ saleItemId: i.saleItemId, quantity: i.quantity, restock: false })) } });
    expect(av.ok(), await av.text()).toBeTruthy();
    expect((await supplier.request.patch('/api/supplier/return-pickups', { data: { id: pick.id, action: 'complete', returnId: (await av.json()).id } })).ok()).toBeTruthy();
  }
  const stats = await (await d.get('/api/delivery/stats')).json(); expect(stats.today.delivered).toBeGreaterThanOrEqual(1);
  await dctx.close();
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

test('6b · vente comptoir : un accessoire vendu sans réparation sort du stock', async () => {
  const name = `Coque robot ${RUN}`;
  // Atelier neuf : on termine la configuration (sinon /app redirige vers /onboarding) puis on ouvre la caisse.
  expect((await atelier.request.post('/api/settings/complete', { data: { name: `Atelier Robot ${RUN}` } })).ok()).toBeTruthy();
  const session = await atelier.request.post('/api/cash-sessions', { data: { openingAmount: 50 } });
  expect(session.ok(), await session.text()).toBeTruthy();
  const created = await atelier.request.post('/api/stock', { data: { sku: `ACC-${RUN}`, name, category: 'Coques', quantity: 5, minQuantity: 1, purchasePrice: 4, salePrice: 15 } });
  expect(created.ok(), await created.text()).toBeTruthy();
  await atelier.evaluate(() => localStorage.setItem('fixi-tour-atelier-v1', '1')); // visite guidée déjà vue
  await atelier.goto('/app/cashier?mode=comptoir');
  const tile = atelier.locator('.fxm-cs-item', { hasText: name });
  await tile.click();
  await tile.click();
  await expect(atelier.locator('.fxm-cs-line', { hasText: name })).toContainText('30');
  await atelier.getByRole('button', { name: /Encaisser la vente/ }).click();
  await expect(atelier.getByText('Vente encaissée')).toBeVisible();
  const after = await (await atelier.request.get('/api/counter-sales?q=' + encodeURIComponent(name))).json();
  expect(after.items.find((i: any) => i.name === name).quantity).toBe(3);
  expect(after.sales[0].total).toBe('30');

  // Retour client : une coque rapportée, remboursée et remise en stock.
  await atelier.getByRole('button', { name: 'Nouvelle vente' }).click();
  await atelier.locator('.fxm-cs-sale-main', { hasText: name }).click();
  await atelier.locator('.fxm-rf-line', { hasText: name }).getByRole('button', { name: 'Plus' }).click();
  await atelier.locator('.fxm-rf .fxm-cs-cats button', { hasText: 'Ne convient pas' }).click();
  await atelier.getByRole('button', { name: /^Rembourser/ }).click();
  await expect(atelier.getByText('Remboursement effectué')).toBeVisible();
  const back = await (await atelier.request.get('/api/counter-sales?q=' + encodeURIComponent(name))).json();
  expect(back.items.find((i: any) => i.name === name).quantity).toBe(4);
  expect(back.sales[0].refundedTotal).toBe('15');
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
