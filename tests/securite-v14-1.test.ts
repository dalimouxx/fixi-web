import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { clientIp } from '../src/lib/login-guard';
import { loginSchema } from '../src/lib/validators';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

test("l'adresse du client vient du proxy, pas de la valeur inventable en tête", () => {
  const req = new Request('http://x', { headers: { 'x-forwarded-for': '6.6.6.6, 41.230.1.2' } });
  assert.equal(clientIp(req), '41.230.1.2');
  assert.equal(clientIp(new Request('http://x')), 'local');
});

test('les 4 connexions (atelier, fournisseur, livreur, Control) limitent les essais', () => {
  for (const p of ['src/app/api/auth/login/route.ts', 'src/app/api/supplier/auth/login/route.ts', 'src/app/api/delivery/auth/login/route.ts', 'src/app/api/platform/auth/login/route.ts']) {
    const s = read(p);
    assert.ok(s.includes('loginGuard('), p);
    assert.ok(s.includes('guard.fail()') && s.includes('guard.blocked()'), p);
  }
});

test('la page publique de connexion ne révèle plus les identifiants des employés', () => {
  const s = read('src/app/api/public/login-options/route.ts');
  assert.ok(!/select:\{id:true,fullName:true,loginCode:true/.test(s));
});

test('connexion par profil (userId) ou par identifiant, jamais sans les deux', () => {
  assert.ok(loginSchema.safeParse({ shopSlug: 'gabes', userId: 'cku12345', pin: '123456' }).success);
  assert.ok(loginSchema.safeParse({ shopSlug: 'gabes', loginCode: 'admin', pin: '123456' }).success);
  assert.ok(!loginSchema.safeParse({ shopSlug: 'gabes', pin: '123456' }).success);
});

test("le nom d'une boutique ne peut pas casser la balise JSON-LD", () => {
  assert.ok(read('src/app/stores/[slug]/page.tsx').includes(".replace(/</g,'\\\\u003c')"));
});
