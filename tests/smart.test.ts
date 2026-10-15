import test from 'node:test';import assert from 'node:assert/strict';import { smartPrice,businessScore,statusWeight } from '../src/lib/smart';
test('Smart Pricing respecte une marge cible',()=>{const x=smartPrice(100,30,30);assert.ok(x.recommendedPrice>=185);assert.ok(x.actualMargin>=30&&x.actualMargin<35)});
test('Business Score reste entre 0 et 100',()=>{const x=businessScore({revenueChange:-20,avgRating:4.5,overdueReady:2,lowStock:3,openWarranty:1,cashDiffCount:1});assert.ok(x.overall>=0&&x.overall<=100);assert.ok(x.satisfaction>=80)});
test('Le poids workflow progresse vers livré',()=>{assert.ok(statusWeight('DELIVERED')>statusWeight('READY'));assert.equal(statusWeight('CANCELLED'),0)});
