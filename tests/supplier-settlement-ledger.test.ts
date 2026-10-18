import assert from 'node:assert/strict';
import { test } from 'node:test';
import { money } from '../src/lib/supplier-settlement-ledger';

test('simple dinar amounts work without .000', () => {
  assert.equal(money('50').toFixed(3), '50.000');
  assert.equal(money(' 50 ').toFixed(3), '50.000');
  assert.equal(money('50.5').toFixed(3), '50.500');
  assert.equal(money('50,5').toFixed(3), '50.500');
  assert.equal(money('50.000').toFixed(3), '50.000');
  assert.equal(money('0.001').toFixed(3), '0.001');
  assert.equal(money('12.345').toFixed(3), '12.345');
});
test('invalid, negative and imprecise inputs are rejected', () => {
  for (const invalid of ['0', '0.000', '', 'abc', '50.1234', '-50', '1e3', '50 DT', '1 000', '9999999999', null, 50]) {
    assert.throws(() => money(invalid), String(invalid));
  }
});
