import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { missingReception } from '../src/lib/reception';

test('Réception : liste claire de ce qui manque, dans l’ordre de la page', () => {
  assert.deepEqual(missingReception({ clientPhone: '21 555 497', clientName: 'Rayen', model: '', reportedIssue: '' }).map(x => x.key), ['model', 'reportedIssue']);
  assert.deepEqual(missingReception({ clientPhone: '215', clientName: 'R', model: 'A54', reportedIssue: 'Écran cassé' }).map(x => x.label), ['téléphone du client', 'nom du client']);
  assert.equal(missingReception({ clientPhone: '21555497', clientName: 'Rayen', model: 'Galaxy A54', reportedIssue: 'Écran cassé' }).length, 0);
});

test('Réception mobile : validation maison (iPhone), champ manquant ciblé', () => {
  const page = readFileSync('src/app/(app)/app/repairs/new/page.tsx', 'utf8');
  assert.ok(page.includes('noValidate') && page.includes("missingReception(f)") && page.includes('data-field="model"') && page.includes('data-field="reportedIssue"'));
  assert.ok(page.includes('role="alert"'));
});

test('Bordure animée : plus de grand cône qui déborde et capte les touchers (Safari)', () => {
  const css = readFileSync('src/app/fixi-max.css', 'utf8');
  assert.ok(!/\.fxm-ba::before\s*\{/.test(css) && !/\.fxm-plan::before\s*\{/.test(css));
  assert.match(css, /@property --fxm-ang/);
  assert.match(css, /\.fxm-ba \{[^}]*contain: paint[^}]*conic-gradient\(from var\(--fxm-ang/);
});

test('Carte « Installer » : jamais ouverte toute seule au milieu d’un formulaire', () => {
  const ip = readFileSync('src/components/install-prompt.tsx', 'utf8');
  assert.ok(ip.includes('const autoOk =') && ip.includes('typing()') && ip.includes('if (!autoOk) setOpen(false)'));
});
