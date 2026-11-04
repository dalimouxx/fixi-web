import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('livreurs partenaires : inclus dans l’abonnement actif, sans encaissement, argent séparé', () => {
  const lib = readFileSync('src/lib/partner-couriers.ts', 'utf8');
  assert.match(lib, /state === 'ACTIVE' \|\| state === 'LEGACY'/);
  const api = readFileSync('src/app/api/supplier/partner-couriers/route.ts', 'utf8');
  assert.ok(api.includes('cashDue: 0') && api.includes('partnerCompanyId: driver.companyId') && api.includes("companyId: { not: s.companyId }"));
  const ev = readFileSync('src/app/api/delivery/events/route.ts', 'utf8');
  assert.ok(ev.includes("partner&&['COD_COLLECTED','DUE_COLLECTED'].includes(type)"));
  assert.ok(ev.includes('tx.supplierDeliveryEvent.create({data:{companyId:o.companyId'));
  const st = readFileSync('src/app/api/delivery/orders/[id]/route.ts', 'utf8');
  assert.ok(st.includes('partnerCompanyId:s.companyId') && st.includes('tx.supplierDriverLocation.create({data:{companyId:o.companyId'));
});
