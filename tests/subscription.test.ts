import test from 'node:test';import assert from 'node:assert/strict';import {addDuration} from '../src/lib/subscription-duration';import {DurationUnit} from '@prisma/client';
test('durée abonnement libre en jours',()=>{assert.equal(addDuration(new Date('2026-09-25T00:00:00Z'),45,DurationUnit.DAY).toISOString().slice(0,10),'2026-11-09')});
test('durée abonnement libre en mois',()=>{assert.equal(addDuration(new Date('2026-09-25T00:00:00Z'),3,DurationUnit.MONTH).toISOString().slice(0,10),'2026-12-25')});
