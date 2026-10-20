import {test} from 'node:test';
import assert from 'node:assert/strict';
import {supplierCashSummary,millimes} from '../src/lib/supplier-cash-ledger';

test('Tunisian millime arithmetic reconciles a professional cash drawer',()=>{
 const result=supplierCashSummary(50.250,[
  {amount:100.125,kind:'IN',method:'CASH'},
  {amount:0.375,kind:'IN',method:'CASH'},
  {amount:20.100,kind:'OUT',method:'CASH'},
  {amount:999,kind:'IGNORE',method:'TRANSFER'},
 ],[{amount:15.250,method:'CASH'}]);
 assert.equal(result.opening,50.25);
 assert.equal(result.incoming,100.5);
 assert.equal(result.outgoing,20.1);
 assert.equal(result.expenses,15.25);
 assert.equal(result.expected,115.4);
 assert.deepEqual(result.byMethod,[{method:'CASH',incoming:100.5,outgoing:20.1}]);
});
test('A bank/card payment without a cash session does not enter drawer totals',()=>{
 const result=supplierCashSummary(15,[],[]);
 assert.equal(result.expected,15);
 assert.equal(result.incoming,0);
});
test('No negative or invalid amounts can enter a cash reconciliation',()=>{
 assert.throws(()=>millimes(Number.POSITIVE_INFINITY));
 assert.throws(()=>supplierCashSummary(0,[{amount:-1,kind:'IN',method:'CASH'}],[]));
 assert.throws(()=>supplierCashSummary(0,[],[{amount:-1,method:'CASH'}]));
});
test('fractional millimes rounded once per individual movement',()=>{
 const result=supplierCashSummary(1.001,[
  {amount:.003,kind:'IN',method:'CASH'},
  {amount:.003,kind:'IN',method:'CASH'},
 ],[]);
 assert.equal(result.expected,1.007);
});
