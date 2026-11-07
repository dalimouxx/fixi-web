import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ExcelJS from 'exceljs';
import { buildStockWorkbook, exportFileName, stockRow, stockSummary } from '../src/lib/supplier-stock-export';
import { rowsFromTable } from '../src/lib/product-quick';
import { cleanReason, uiCookieValue } from '../src/lib/support-access';
import { searchTerms } from '../src/lib/platform-search';
import { launchChecks, launchScore } from '../src/lib/launch-check';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const P = (o: any) => ({ sku: 'SKU1', barcode: '6191234567890', name: 'Écran iPhone 13', brand: 'Apple', category: 'Écrans', qualityGrade: 'OLED', price: 185, retailPrice: null, wholesalePrice: 170, minimumPrice: null, purchasePrice: 140, averageCost: 0, taxRate: 19, stock: 4, reservedStock: 1, minStock: 3, maxStock: null, location: 'A1', warrantyDays: 90, active: true, updatedAt: new Date('2026-11-01'), ...o });

test('Export stock : valeurs, disponible, stock bas, résumé', () => {
  const r = stockRow(P({}));
  assert.equal(r.price, 185); assert.equal(r.cost, 140, 'coût moyen nul → prix d’achat'); assert.equal(r.available, 3); assert.equal(r.low, true);
  assert.equal(r.costValue, 560);
  const s = stockSummary([r, stockRow(P({ sku: 'X', stock: 0, reservedStock: 0, active: false }))]);
  assert.equal(s.products, 2); assert.equal(s.active, 1); assert.equal(s.units, 4); assert.equal(s.costValue, 560);
  assert.match(exportFileName('Pièces Gabès SARL', new Date('2026-11-07T10:00:00Z')), /^stock-pieces-gabes-sarl-2026-11-07\.xlsx$/);
});

test('Export stock : fichier Excel ré-importable (mêmes colonnes que l’import)', async () => {
  const { buffer } = await buildStockWorkbook({ name: 'Démo' }, [P({}), P({ sku: 'B2', barcode: null, name: 'Batterie A12', price: 35, stock: 10 })] as any);
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buffer as any);
  assert.deepEqual(wb.worksheets.map(w => w.name), ['Stock', 'À réapprovisionner', 'Résumé']);
  const table: string[][] = []; wb.getWorksheet('Stock')!.eachRow(row => table.push((row.values as any[]).slice(1).map(v => v instanceof Date ? '' : String(v ?? ''))));
  const { rows, missing } = rowsFromTable(table);
  assert.deepEqual(missing, []);
  assert.equal(rows.length, 2); assert.equal(rows[0].name, 'Écran iPhone 13'); assert.equal(rows[0].barcode, '6191234567890'); assert.equal(rows[1].price, '35'); assert.equal(rows[0].purchasePrice, '140');
});

test('Export stock : rôles, journal et bouton', () => {
  const route = read('src/app/api/supplier/products/export/route.ts');
  assert.match(route, /requireSupplierRole\(STOCK_EXPORT_ROLES\)/); assert.match(route, /STOCK_EXPORT/); assert.match(route, /companyId: s\.companyId/);
  assert.match(read('src/components/supplier-dashboard.tsx'), /\/api\/supplier\/products\/export/);
});

test('Mode support : motif obligatoire, 1 h, journal, notification, bandeau', () => {
  assert.equal(cleanReason('  bug '), null); assert.equal(cleanReason('Caisse   bloquée'), 'Caisse bloquée');
  const v = JSON.parse(decodeURIComponent(uiCookieValue({ kind: 'SHOP', targetName: 'Atelier', adminName: 'Ali' }, new Date(1000))));
  assert.deepEqual(v, { k: 'SHOP', n: 'Atelier', a: 'Ali', e: 1000 });
  const lib = read('src/lib/support-access.ts');
  for (const s of ['SUPPORT_TTL_SECONDS = 60 * 60', 'supportAccess.create', "action: 'SUPPORT_ACCESS'", 'notifyShop', 'httpOnly: true', 'destroySession', 'destroySupplierSession'])
    assert.ok(lib.includes(s), s);
  assert.match(read('src/app/api/platform/support-access/route.ts'), /requirePlatformSession/);
  assert.match(read('src/app/layout.tsx'), /<SupportBanner\/>/);
  assert.match(read('prisma/schema.prisma'), /model SupportAccess \{/);
});

test('Recherche Control : téléphone tunisien normalisé', () => {
  assert.equal(searchTerms('+216 22 123 456').phone, '22123456');
  assert.equal(searchTerms('Atelier').phone, '');
  assert.equal(searchTerms('a').ok, false);
});

test('Prêt pour la mise en ligne : bloquants et conseils', () => {
  const facts = { backupAgeHours: 3, restoreOkAgeDays: 2, errors24h: 0, platformAdmins: 1, platformAdminsWithout2fa: 0, shops: 2, shopsWithoutRecovery: 0, openProblems: 0 };
  const k = (n: string) => n.repeat(40);
  const env = { AUTH_SECRET: k('a'), PLATFORM_AUTH_SECRET: k('b'), SUPPLIER_AUTH_SECRET: k('c'), DELIVERY_AUTH_SECRET: k('d'), DATA_ENCRYPTION_KEY: k('e'), CRON_SECRET: k('f'), NEXT_PUBLIC_APP_URL: 'https://fixi.example.tn', TELEGRAM_BOT_TOKEN: 'x', TELEGRAM_CHAT_ID: '1' };
  assert.deepEqual(launchScore(launchChecks(env, facts)), { ready: true, bad: 0, warn: 0, done: 11, total: 11 });
  const weak = launchChecks({ ...env, AUTH_SECRET: 'dev-secret-change-this-immediately-123456', NEXT_PUBLIC_APP_URL: 'http://localhost:3000' }, { ...facts, backupAgeHours: null });
  assert.deepEqual(weak.filter(c => !c.ok).map(c => c.key), ['secrets', 'https', 'backup']);
  assert.equal(launchScore(launchChecks({ ...env, PLATFORM_AUTH_SECRET: env.AUTH_SECRET }, facts)).ready, false, 'clés identiques refusées');
});
