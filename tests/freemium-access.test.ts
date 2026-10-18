import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveFixiAccess, isConnectAppPath } from '../src/lib/freemium';

const sub = (status: 'ACTIVE'|'TRIAL'|'SUSPENDED'|'PAST_DUE'|'CANCELLED', code='PRO', endsAt:string|null=null) =>
  ({status,plan:{code},endsAt});

test('free without subscription or with a CONNECT plan', () => {
  assert.equal(resolveFixiAccess(null), 'CONNECT');
  assert.equal(resolveFixiAccess(sub('ACTIVE','CONNECT')), 'CONNECT');
});
test('active or unexpired premium stays premium', () => {
  assert.equal(resolveFixiAccess(sub('ACTIVE')), 'PRO');
  assert.equal(resolveFixiAccess(sub('TRIAL','BUSINESS','2026-10-20'), new Date('2026-10-18')), 'PRO');
});
test('expired and suspended subscriptions keep Connect rights', () => {
  for(const status of ['SUSPENDED','PAST_DUE','CANCELLED'] as const)
    assert.equal(resolveFixiAccess(sub(status)), 'CONNECT');
  assert.equal(resolveFixiAccess(sub('ACTIVE','PRO','2026-10-17'),new Date('2026-10-18')), 'CONNECT');
});
test('Connect can open orders, invoice statements and upgrade, not workshop', () => {
  for(const p of ['/app/suppliers','/app/suppliers/orders/abc/ticket','/app/mes-dettes','/app/subscription','/app/upgrade','/app/support'])
    assert.equal(isConnectAppPath(p), true, p);
  for(const p of ['/app/dashboard','/app/repairs/new','/app/stock','/app/cashier','/app/suppliers-admin'])
    assert.equal(isConnectAppPath(p), false, p);
});
