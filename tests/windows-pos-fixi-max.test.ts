import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Caisse Windows Fixi Max : logo animé, habillage clair par défaut, thème appliqué partout', () => {
  const brand = readFileSync('apps/windows-pos/src/brand.tsx', 'utf8');
  assert.ok(brand.includes('fxm-logo') && brand.includes('fxm-logo-core'));
  const pos = readFileSync('apps/windows-pos/src/CaisseV4.tsx', 'utf8');
  assert.ok(pos.includes("import './fixi-max.css';") && pos.indexOf("import './fixi-max.css';") > pos.indexOf("import './v5.css';"));
  assert.ok(pos.includes('document.documentElement.dataset.theme=t===\'dark\''), 'thème appliqué avant le rendu (atelier compris)');
  assert.ok(readFileSync('apps/windows-pos/src/storage.ts', 'utf8').includes("theme:'light'"));
  const pcss = readFileSync('apps/windows-pos/src/fixi-max.css', 'utf8');
  assert.match(pcss, /:root\[data-theme=dark\]\{/);
  assert.match(pcss, /prefers-reduced-motion:reduce/);
});

test('Caisse Windows atelier : vente comptoir, douchette, tiroir, ticket et retours', () => {
  const at = readFileSync('apps/windows-pos/src/atelier.tsx', 'utf8');
  assert.ok(at.includes("['comptoir', ShoppingBag, 'Vente comptoir']") && at.includes('<CounterSaleTab') && at.includes("session.role === 'ADMIN'"));
  assert.ok(at.includes('p.counterSale?.number'), 'fin de journée : ventes comptoir affichées');
  assert.ok(at.includes('function SaleTicket') && at.includes("'REMBOURSEMENT'"));
  const cs = readFileSync('apps/windows-pos/src/atelier-comptoir.tsx', 'utf8');
  for (const k of ["'/api/counter-sales'", '/refund`', "cash_drawer_open", "e.key === 'Enter') void scan()", 'managerPin: manager ? undefined : pin', "r !== 'Article défectueux'", 'needSession']) assert.ok(cs.includes(k), k);
  const rs = readFileSync('apps/windows-pos/src-tauri/src/atelier.rs', 'utf8');
  assert.ok(rs.includes('("POST", ["api", "counter-sales", id, "refund"]) => id_ok(id)') && rs.includes('assert!(!allowed("GET", "/api/counter-sales/../users"));'));
});
