import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateSubscriptionProof,normalizedTransferRef} from '../src/lib/subscription-proof';

const jpg='data:image/jpeg;base64,'+Buffer.alloc(90,16).toString('base64');
test('valid proof formats and reference normalization',()=>{
 assert.equal(validateSubscriptionProof(jpg).valid,true);
 assert.equal(validateSubscriptionProof('data:application/pdf;base64,'+Buffer.alloc(110,8).toString('base64')).valid,true);
 assert.equal(normalizedTransferRef('  D17   # 123  '),'D17 # 123');
});
test('reject malicious/unsupported transfers',()=>{
 assert.equal(validateSubscriptionProof('data:text/html;base64,'+Buffer.alloc(100,8).toString('base64')).valid,false);
 assert.equal(validateSubscriptionProof('data:image/svg+xml;base64,'+Buffer.alloc(100,8).toString('base64')).valid,false);
 assert.equal(validateSubscriptionProof('data:image/png;base64,'+Buffer.alloc(2_100_000,8).toString('base64')).valid,false);
 assert.equal(validateSubscriptionProof('data:image/jpeg;base64,YQ==').valid,false);
 assert.equal(validateSubscriptionProof(null).valid,true);
});
