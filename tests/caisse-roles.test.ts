import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { can, permsOf, rolesWith, discountPct, DESKTOP_ROLES, ROLE_PERMS } from '../src/lib/supplier-permissions';
import { validApprovalPin } from '../src/lib/supplier-approval';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('Table des droits : ce que chaque rôle peut faire', () => {
  assert.equal(permsOf('OWNER').length, permsOf('ADMIN').length);
  assert.equal(can('MANAGER', 'team'), false); assert.equal(can('MANAGER', 'productPrice'), true);
  assert.equal(can('STOCK', 'stockIn'), true); assert.equal(can('STOCK', 'productPrice'), false); assert.equal(can('STOCK', 'sell'), false);
  assert.equal(can('CASHIER', 'sell'), true); assert.equal(can('CASHIER', 'seeCost'), false); assert.equal(can('CASHIER', 'refund'), false); assert.equal(can('CASHIER', 'discount'), false);
  assert.equal(can('SALES', 'quotes'), true); assert.equal(can('SALES', 'documents'), false);
  assert.equal(can('ACCOUNTANT', 'expenses'), true); assert.equal(can('ACCOUNTANT', 'sell'), false);
  assert.equal(can('DRIVER', 'sell'), false); assert.equal(can(undefined, 'sell'), false);
  assert.deepEqual(rolesWith('team').sort(), ['ADMIN', 'OWNER']);
  assert.ok(DESKTOP_ROLES.includes('STOCK') && DESKTOP_ROLES.includes('ACCOUNTANT'));
  for (const perms of Object.values(ROLE_PERMS)) for (const p of perms) assert.ok(ROLE_PERMS.OWNER.includes(p));
});

test('Code gérant : format et remise', () => {
  assert.equal(validApprovalPin('1234'), true); assert.equal(validApprovalPin('123456'), true);
  assert.equal(validApprovalPin('123'), false); assert.equal(validApprovalPin('12a4'), false);
  assert.equal(discountPct(200, 30), 15); assert.equal(discountPct(0, 5), 0);
});

test('Serveur : la table est appliquée (vente, remboursement, achats, dépenses, prix, promos, devis)', () => {
  const erp = read('src/app/api/supplier/erp/route.ts');
  assert.match(erp, /checkPermOrApproval\(s,'discount',b\.approval\)/);
  assert.match(erp, /if\(!can\(s\.role,'purchases'\)\)/); assert.match(erp, /if\(!can\(s\.role,'expenses'\)\)/); assert.match(erp, /if\(!can\(s\.role,'vendorPay'\)\)/);
  for (const p of ['src/app/api/supplier/desktop/returns/create/route.ts', 'src/app/api/supplier/desktop/v4/returns/route.ts']) assert.match(read(p), /checkPermOrApproval\(s,'refund',body\?\.approval\)/, p);
  assert.match(read('src/app/api/supplier/products/route.ts'), /prix de vente sont réservés au gérant/);
  assert.match(read('src/app/api/supplier/promos/route.ts'), /EDITORS = \['OWNER', 'ADMIN', 'MANAGER'\]/);
  assert.match(read('src/app/api/supplier/documents/route.ts'), /type==='QUOTE'\?can\(s\.role,'quotes'\)/);
  assert.match(read('src/app/api/supplier/desktop/bootstrap/route.ts'), /requireSupplierRole\(DESKTOP_ROLES\)[\s\S]*perms:permsOf\(s\.role\)/);
  const appr = read('src/app/api/supplier/approval/route.ts'); assert.match(appr, /loginGuard\('supplier-approval'/);
  assert.match(read('prisma/schema.prisma'), /approvalPinHash +String\?/); assert.match(read('prisma/schema.prisma'), /staffDiscountLimitPct +Int +@default\(10\)/);
});

test('Caisse Windows : menus selon les droits, modules de gestion, liste d’accès Rust', () => {
  const pos = read('apps/windows-pos/src/CaisseV4.tsx');
  assert.match(pos, /filter\(id=>pageAllowed\(id,perms\)\)/);
  assert.match(pos, /askApproval\('discount'/); assert.match(pos, /askApproval\('refund'/);
  assert.match(pos, /<ManageModule page=/);
  const m = read('apps/windows-pos/src/manage.tsx');
  for (const x of ['ProductsAdmin', 'Purchases', 'Expenses', 'Documents', 'Delivery', 'Reports', 'Team', 'Warehouses', 'Rights', 'ApprovalDialog']) assert.ok(m.includes('function ' + x), x);
  const rs = read('apps/windows-pos/src-tauri/src/supplier_api.rs');
  assert.match(rs, /ERP_ACTIONS: &\[&str\] = &\["PURCHASE", "PURCHASE_PAYMENT", "EXPENSE", "STOCK_ADJUST"\]/);
  assert.doesNotMatch(rs.split('#[cfg(test)]')[0], /"SALE"/, 'les ventes ne passent pas par la commande générique');
  assert.match(read('apps/windows-pos/src-tauri/src/lib.rs'), /generate_handler!\[supplier_api,/);
});
