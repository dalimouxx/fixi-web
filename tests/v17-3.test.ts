import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { slugify, normalizePhone, weakPin, validateSignup, GOUVERNORATS } from '../src/lib/signup';

const good = { shopName: 'Phone Clinic Sousse', region: 'Sousse', city: '', fullName: 'Mohamed Ali', phone: '+216 20 123 456', pin: '482915', pinConfirm: '482915', accept: true };

test('slug sans accents ni symboles', () => {
    assert.equal(slugify('Réparation Ézzine & Fils !'), 'reparation-ezzine-fils');
    assert.equal(slugify('A'), 'atelier-a');
  });
test('téléphone tunisien normalisé', () => {
    assert.equal(normalizePhone('+216 20 123 456'), '20123456');
    assert.equal(normalizePhone('0021698765432'), '98765432');
    assert.equal(normalizePhone('12345'), null);
    assert.equal(normalizePhone('01234567'), null);
  });
test('PIN simples refusés', () => {
    for (const p of ['000000', '123456', '654321', '111111']) assert.equal(weakPin(p), true);
    assert.equal(weakPin('482915'), false);
  });
test('validation', () => {
    const v = validateSignup(good);
    assert.equal(v.ok && v.value.phone, '20123456');
    assert.equal(validateSignup({ ...good, pinConfirm: '482916' }).ok, false);
    assert.equal(validateSignup({ ...good, region: 'Paris' }).ok, false);
    assert.equal(validateSignup({ ...good, accept: false }).ok, false);
    assert.equal(GOUVERNORATS.length, 24);
  });
test('route : abonnement Connect gratuit, actif, sans fin', () => {
    const s = readFileSync('src/app/api/public/signup/route.ts', 'utf8');
    assert.ok(s.includes('ensureConnectPlan()'));
    assert.match(s, /status: SubscriptionStatus\.ACTIVE, endsAt: null, agreedPrice: 0/);
    assert.ok(s.includes('role: UserRole.ADMIN'));
    assert.ok(s.includes('createSession('));
  });
test('les boutons de la page d’accueil mènent à l’inscription', () => {
    assert.ok(!readFileSync('src/app/page.tsx', 'utf8').includes('href="/onboarding"'));
    assert.ok(readFileSync('src/components/login-form.tsx', 'utf8').includes('/inscription'));
  });

