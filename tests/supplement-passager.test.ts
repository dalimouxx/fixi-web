import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

test('serveur : le supplément passager s’ajoute au prix, se trace à part, et ne masque jamais une remise', () => {
  const erp = read('src/app/api/supplier/erp/route.ts');
  assert.match(erp, /const extra=Math\.max\(0,money\(i\.extra\|\|0\)\)/, 'supplément jamais négatif');
  assert.match(erp, /const price=money\(base\+extra\)/);
  assert.match(erp, /base<minimum/, 'prix minimum contrôlé sur le prix de base');
  assert.match(erp, /if\(base<refPrice\)manualOff\+=\(refPrice-base\)\*q/, 'remise calculée sur le prix de base');
  assert.match(erp, /walkInExtra:money\(/);
  assert.match(erp, /unitPrice:x\.price,extra:x\.extra\|\|0/);
  const schema = read('prisma/schema.prisma');
  assert.match(schema, /walkInExtra\s+Decimal\s+@default\(0\)/);
  assert.match(schema, /extra\s+Decimal @default\(0\)/);
});

test('caisse Windows : prix de base + supplément envoyés à part ; ticket et écran client montrent seulement le prix final', () => {
  const c = read('apps/windows-pos/src/CaisseV4.tsx');
  assert.match(c, /unitPrice:priceFor\(e\.product\),\.\.\.\(extraFor\(e\.product\)>0\?\{extra:extraFor\(e\.product\)\}:\{\}\)/);
  assert.match(c, /function receipt\([^)]*\):ReceiptData\{return \{reference,lines:\[\.\.\.entries\.map\(x=>\(\{name:x\.product\.name,quantity:x\.quantity,price:priceFor\(x\.product\)\+extraFor\(x\.product\)\}\)\)/);
  assert.match(c, /publishDisplay\(\{company:boot\.companyName,logo,lines:\[\.\.\.entries\.map\(x=>\(\{name:x\.product\.name,quantity:x\.quantity,price:priceFor\(x\.product\)\+extraFor\(x\.product\)\}\)\)/);
  assert.match(c, /walk-in-suggestions/);
  assert.doesNotMatch(read('apps/windows-pos/src/TicketV4.tsx'), /suppl[ée]ment|passager|extra/i, 'rien sur le ticket');
  assert.match(read('apps/windows-pos/src-tauri/src/supplier_api.rs'), /\("GET", \["api", "supplier", "walk-in-suggestions"\]\) => true/);
});

test('ticket web : nom du caissier ; rapport journalier : supplément passagers par caissier, jour de Tunis', () => {
  assert.match(read('src/components/supplier-thermal-receipt.tsx'), /<span>Caissier<\/span><span>\{cashier\}<\/span>/);
  assert.doesNotMatch(read('src/components/supplier-thermal-receipt.tsx'), /walkIn|extra/);
  const r = read('src/app/supplier/daily-report/page.tsx');
  assert.match(r, /dont supplément passagers/);
  assert.match(r, /Supplément passagers par caissier/);
  assert.match(r, /timeZone:'Africa\/Tunis'\}\)\.format\(new Date\(\)\)/, '« aujourd’hui » = jour de Tunis');
});
