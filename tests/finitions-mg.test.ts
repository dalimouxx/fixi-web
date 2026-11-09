import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { translateAr } from '../src/lib/i18n-dictionary';

const read = (p: string) => fs.readFileSync(path.join(path.resolve(__dirname, '..'), p), 'utf8');

test('arabe : écran des lignes et mode passager traduits', () => {
  for (const t of ['Lignes de produits', 'Pièces vendues', 'Dû des clients', 'À payer à', 'Stock —', 'Barème de bénéfice —', 'dépôt-vente', 'Inventaire de cette ligne', 'Passager',
    'Client de passage : supplément au prix atelier, non visible sur le ticket', 'Le reste du prix de vente revient à', 'Panier']) assert.notEqual(translateAr(t), t, t);
  assert.equal(translateAr('Supplément passager pour Afficheur A04'), 'زيادة الزبون العابر لـ Afficheur A04');
  assert.equal(translateAr('Depuis 07:26'), 'منذ 07:26');
});

test('caisse Windows : étiquette MG, ligne à la création, traductions', () => {
  assert.match(read('apps/windows-pos/src/labels.tsx'), /<strong>\{p\.tag\|\|'FIXI'\}<\/strong>/);
  assert.match(read('apps/windows-pos/src/dialogs.tsx'), /Ligne de produits/);
  assert.match(read('apps/windows-pos/src-tauri/src/lib.rs'), /"location","lineId"\]/);
  const i18n = read('apps/windows-pos/src/i18n.ts');
  for (const t of ["'Passager':", "'Ligne de produits':", "'Client de passage : ajouter un supplément au prix atelier (non visible sur le ticket)':", 'Supplément passager pour']) assert.ok(i18n.includes(t), t);
});

test('caisse web : bouton Passager et supplément envoyé à part', () => {
  const pos = read('src/components/supplier-pos.tsx');
  assert.match(pos, /Passager\{walkIn&&walkInTotal>0/);
  assert.match(pos, /unitPrice:l\.unitPrice,\.\.\.\(extraOf\(l\)>0\?\{extra:extraOf\(l\)\}:\{\}\)/);
});
