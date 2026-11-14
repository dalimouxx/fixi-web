import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { monthlyDue } from '../src/lib/field-ops';
import { pageRule } from '../apps/windows-pos/src/print-page';

const DAY = 86400_000, now = Date.UTC(2026, 10, 14);
const sale = (ageDays: number, total: number, paid = 0) => ({ id: 's' + ageDays, total, paid, createdAt: new Date(now - ageDays * DAY) });
const pay = (ageDays: number, amount: number, saleCreatedAt?: Date) => ({ amount, createdAt: new Date(now - ageDays * DAY), saleCreatedAt });

test('sans règle : jamais bloqué', () => {
    assert.equal(monthlyDue({ minAmount: 0, pct: 0 }, [sale(90, 500)], [], now).late, false);
  });
test('dû récent (moins de 30 jours) : pas encore exigible', () => {
    assert.equal(monthlyDue({ minAmount: 100, pct: 0 }, [sale(10, 500)], [], now).late, false);
  });
test('ancien dû sans paiement : bloqué, il manque le minimum', () => {
    const m = monthlyDue({ minAmount: 100, pct: 0 }, [sale(45, 500)], [], now);
    for (const [k, v] of Object.entries({ late: true, required: 100, missing: 100, oldDue: 500 })) assert.equal((m as any)[k], v, k);
  });
test('minimum réglé dans les 30 jours : débloqué', () => {
    const m = monthlyDue({ minAmount: 100, pct: 0 }, [sale(45, 500, 100)], [pay(3, 100, new Date(now - 45 * DAY))], now);
    assert.equal(m.late, false); assert.equal(m.paid, 100);
  });
test('le minimum ne dépasse jamais l’ancien dû', () => {
    const m = monthlyDue({ minAmount: 200, pct: 0 }, [sale(45, 50)], [], now);
    assert.equal(m.required, 50); assert.equal(m.missing, 50);
  });
test('règle en % : part de l’ancien dû', () => {
    const m = monthlyDue({ minAmount: 0, pct: 20 }, [sale(60, 1000, 50)], [pay(5, 50, new Date(now - 60 * DAY))], now);
    // base = 950 restant + 50 payé = 1000 → 20 % = 200, déjà 50
    for (const [k, v] of Object.entries({ required: 190 + 10, paid: 50, missing: 150, late: true })) assert.equal((m as any)[k], v, k);
  });
test('un paiement fait à l’achat ou trop ancien ne compte pas', () => {
    const at = new Date(now - 2 * DAY);
    const m = monthlyDue({ minAmount: 100, pct: 0 }, [sale(45, 500)], [{ amount: 300, createdAt: at, saleCreatedAt: at }, pay(40, 300)], now);
    assert.equal(m.paid, 0); assert.equal(m.late, true);
  });
test('le blocage est branché sur la vente à crédit et sur la commande de l’atelier', () => {
    assert.match(readFileSync('src/app/api/supplier/erp/route.ts', 'utf8'), /customerMonthly\(s\.companyId,customer\.id\)/);
    assert.match(readFileSync('src/app/api/marketplace/orders/route.ts', 'utf8'), /Commande bloquée/);
  });

test('la taille étiquette n’est plus dans une feuille de style commune du site', () => {
    assert.doesNotMatch(readFileSync('src/app/fixi-v15.css', 'utf8'), /@page\s*\{\s*size:\s*50mm/);
    assert.match(readFileSync('src/app/label/[code]/page.tsx', 'utf8'), /size:50mm 30mm/);
  });
test('caisse Windows : ticket 80 mm, documents et rapports A4, étiquette à son format', () => {
    assert.ok(pageRule('ticket').includes('80mm auto'));
    assert.ok(pageRule('invoice').includes('A4'));
    assert.ok(pageRule('report').includes('A4'));
    assert.ok(pageRule(undefined).includes('A4'));
    assert.ok(pageRule('labels', '40x20').includes('40mm 20mm'));
    assert.ok(pageRule('labels', '40x20', true).includes('20mm 40mm'));
    assert.ok(pageRule('labels', '60x40').includes('60mm 40mm'));
    assert.doesNotMatch(readFileSync('apps/windows-pos/src/v4.css', 'utf8'), /@page\s*\{\s*size:80mm/);
  });
