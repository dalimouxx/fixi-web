import test from 'node:test';
import assert from 'node:assert/strict';
import {marketplaceAllocation,netReceivable,remainingReturnQuantity,stockDistribution,warehouseAdjustmentGlobalDelta} from '../src/lib/supplier-rules';

test('stock non réparti est consommé avant les dépôts',()=>{
 const x=marketplaceAllocation(20,[{quantity:5},{quantity:7}],10);
 assert.deepEqual(x,{fromUnallocated:8,fromWarehouses:2,allocated:12,unallocated:8,warehouseAvailable:12});
});

test('répartir du stock existant ne double pas le global',()=>{
 const x=warehouseAdjustmentGlobalDelta(20,12,5,10);
 assert.equal(x.diff,5);assert.equal(x.unallocated,8);assert.equal(x.globalDelta,0);assert.equal(x.nextGlobal,20);
});

test('écart physique au-delà du non réparti augmente le global',()=>{
 const x=warehouseAdjustmentGlobalDelta(20,18,5,10);
 assert.equal(x.unallocated,2);assert.equal(x.globalDelta,3);assert.equal(x.nextGlobal,23);
});

test('une baisse de dépôt réduit le stock global',()=>{
 const x=warehouseAdjustmentGlobalDelta(20,18,8,5);
 assert.equal(x.globalDelta,-3);assert.equal(x.nextGlobal,17);
});

test('retour ne peut porter que sur la quantité restant à retourner',()=>{
 assert.equal(remainingReturnQuantity(5,2),3);
 assert.equal(remainingReturnQuantity(5,7),0);
});

test('créance est nette des avoirs et remboursements',()=>{
 assert.deepEqual(netReceivable(100,60,20,10),{netTotal:80,netPaid:50,due:30});
 assert.deepEqual(netReceivable(100,100,100,100),{netTotal:0,netPaid:0,due:0});
});

test('stock réservé est exclu du disponible dépôt',()=>{
 const x=stockDistribution(15,[{quantity:10,reserved:4}]);
 assert.equal(x.warehouseAvailable,6);assert.equal(x.unallocated,5);
});
