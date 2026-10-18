import assert from 'node:assert/strict';
import { test } from 'node:test';
import { money } from '../src/lib/supplier-settlement-ledger';
test('money precision', () => { assert.equal(money('12.345').toString(), '12.345'); });
test('reject zero', () => { assert.throws(() => money('0.000')); });
