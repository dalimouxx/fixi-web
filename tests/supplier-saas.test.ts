import assert from 'node:assert/strict';
import { test } from 'node:test';
import { supplierOfferState } from '../src/lib/supplier-saas';

test('legacy suppliers remain able to operate after migration',()=>{
  assert.equal(supplierOfferState(null),'LEGACY');
});
test('live and trial supplier plans are distinct',()=>{
  assert.equal(supplierOfferState({status:'ACTIVE',endsAt:null}),'ACTIVE');
  assert.equal(supplierOfferState({status:'TRIAL',endsAt:'2030-01-01'},new Date('2026-01-01')),'TRIAL');
});
test('expired supplier plans are expired even if active in database',()=>{
  assert.equal(supplierOfferState({status:'ACTIVE',endsAt:'2026-10-01'},new Date('2026-10-19')),'EXPIRED');
  assert.equal(supplierOfferState({status:'ACTIVE',endsAt:'2026-10-19'},new Date('2026-10-19')),'EXPIRED');
});
test('suspended, cancelled or unpaid supplier plans are not active',()=>{
  for(const status of ['SUSPENDED','CANCELLED','PAST_DUE'] as const){
    assert.equal(supplierOfferState({status,endsAt:null}),'SUSPENDED');
  }
});
