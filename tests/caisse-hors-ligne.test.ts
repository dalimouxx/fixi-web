import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { translateAr } from '../src/lib/i18n-dictionary';
import { arV19 } from '../src/lib/i18n-v19';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('Vente comptoir : clientRef rend l’envoi idempotent (jamais de double vente)', () => {
  const route = read('src/app/api/counter-sales/route.ts');
  assert.match(route, /\^\[A-Za-z0-9_-\]\{6,40\}\$/);
  assert.match(route, /findFirst\(\{ where: \{ shopId: s\.shopId, clientRef \}/);
  assert.match(route, /duplicate: true/);
  const schema = read('prisma/schema.prisma');
  assert.match(schema, /clientRef\s+String\?/);
  assert.match(schema, /@@index\(\[shopId, clientRef\]\)/);
  assert.doesNotMatch(schema, /@@unique\(\[shopId, clientRef\]\)/, 'pas de contrainte unique : db push sans perte de données');
});

test('Caisse Windows : file hors ligne (espèces seulement), envoi automatique au retour d’Internet', () => {
  const src = read('apps/windows-pos/src/atelier-comptoir.tsx');
  for (const s of ['QUEUE_KEY', 'ITEMS_KEY', 'export async function flushQueue', 'export const isNetworkError', "'HL-'", "method !== 'CASH'", "addEventListener('online'", 'Envoyer maintenant', 'at-cs-offline'])
    assert.ok(src.includes(s), `manque ${s}`);
  assert.match(src, /clientRef/);
  assert.match(read('apps/windows-pos/src/atelier.tsx'), /Vente enregistrée hors ligne/);
  assert.match(read('apps/windows-pos/src/fixi-max.css'), /\.at-cs-offline/);
});

test('Arabe : les nouveaux écrans sont traduits', () => {
  for (const fr of ['Vente comptoir', 'Encaisser la vente', 'Rembourser', 'Monnaie à rendre'])
    assert.ok(/[؀-ۿ]/.test(translateAr(fr)), `non traduit : ${fr}`);
  for (const [fr, ar] of Object.entries(arV19)) {
    assert.ok(fr.trim() && ar.trim(), `entrée vide : ${fr}`);
    assert.ok(/[؀-ۿ]/.test(ar), `pas d’arabe pour : ${fr}`);
  }
  assert.ok(Object.keys(arV19).length > 120, 'dictionnaire v19 trop court');
});
