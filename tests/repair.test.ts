import test from 'node:test';import assert from 'node:assert/strict';import { canTransition } from '../src/lib/repair';import { RepairStatus,UserRole } from '@prisma/client';
test('workflow technicien refuse livraison directe depuis reçu',()=>{assert.equal(canTransition(RepairStatus.RECEIVED,RepairStatus.DELIVERED,UserRole.TECHNICIAN),false)});
test('workflow autorise réparation vers prêt',()=>{assert.equal(canTransition(RepairStatus.IN_REPAIR,RepairStatus.READY,UserRole.TECHNICIAN),true)});
test('gérant garde override administratif',()=>{assert.equal(canTransition(RepairStatus.RECEIVED,RepairStatus.READY,UserRole.ADMIN),true)});
test('caissier ne peut pas démarrer un diagnostic',()=>{assert.equal(canTransition(RepairStatus.RECEIVED,RepairStatus.DIAGNOSIS,UserRole.CASHIER),false)});
test('caissier peut livrer un appareil prêt',()=>{assert.equal(canTransition(RepairStatus.READY,RepairStatus.DELIVERED,UserRole.CASHIER),true)});
test('technicien ne peut pas livrer',()=>{assert.equal(canTransition(RepairStatus.READY,RepairStatus.DELIVERED,UserRole.TECHNICIAN),false)});
