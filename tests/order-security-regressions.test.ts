import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const source=(p:string)=>readFileSync(resolve(process.cwd(),p),'utf8');

test('every printable delivery ticket QR identifies a ticket, not the shop handoff OTP',()=>{
  for(const route of [
    'src/app/delivery/orders/[id]/ticket/page.tsx',
    'src/app/supplier/orders/[id]/ticket/page.tsx',
    'src/app/(app)/app/suppliers/orders/[id]/ticket/page.tsx',
  ]) {
    const s=source(route);
    assert.ok(s.includes("QRCode.toDataURL('FIXI-TICKET:'+order.reference"),route);
    assert.ok(!s.includes("QRCode.toDataURL(String(order.deliveryCode"),route);
  }
  assert.ok(!source('src/components/delivery-ticket.tsx').includes('order.deliveryCode'));
});

test('courier order listings and receipts do not return the secret delivery code',()=>{
  const route=source('src/app/api/delivery/orders/route.ts');
  assert.match(route,/deliveryCode:secretCode/);
  assert.match(route,/proofCode,\.\.\.safe/);
  const change=source('src/app/api/delivery/orders/[id]/route.ts');
  assert.ok(!change.includes('return ok(plain(result))'));
  assert.ok(!change.includes('return ok(plain(o))'));
});

test('Supplier order status advances through confirmation and preparation before dispatch',()=>{
  const route=source('src/app/api/supplier/orders/[id]/route.ts');
  assert.ok(!route.includes('status=SupplierOrderStatus.READY_FOR_DELIVERY;if(status'));
  assert.match(route,/PENDING:\[SupplierOrderStatus.CONFIRMED/);
  assert.match(route,/CONFIRMED:\[SupplierOrderStatus.PREPARING/);
  assert.match(route,/PREPARING:\[SupplierOrderStatus.READY_FOR_DELIVERY/);
});

test('shop marketplace never sends internal procurement cost fields',()=>{
  const productRoute=source('src/app/api/marketplace/products/route.ts');
  assert.ok(productRoute.includes('select:{id:true,sku:true'));
  assert.ok(!productRoute.includes('purchasePrice:true'));
  const ordersRoute=source('src/app/api/marketplace/orders/route.ts');
  assert.ok(!ordersRoute.includes('items:{include:{product:true}}'));
});
