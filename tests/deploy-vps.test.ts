import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

test('le serveur réel démarre en « base vierge » : formules et catalogue, aucune boutique de démonstration', () => {
  const compose = read('deploy/vps/docker-compose.yml');
  assert.match(compose, /SEED_MODE: production/);
  assert.match(compose, /prisma db push --skip-generate/);
  assert.ok(!/accept-data-loss/.test(compose), 'jamais de perte de données au démarrage');
  const seed = read('prisma/seed.ts');
  assert.match(seed, /process\.env\.SEED_MODE === 'production'/);
  assert.match(seed, /if \(!production\) \{\s*\n\s*let shop/, 'la boutique de démonstration est ignorée en production');
  assert.match(seed, /PLATFORM_ADMIN_PASSWORD doit être défini/, 'pas de mot de passe Control par défaut en production');
});

test('l’adresse publique est obligatoire : elle alimente tous les QR codes et liens', () => {
  const compose = read('deploy/vps/docker-compose.yml');
  assert.match(compose, /NEXT_PUBLIC_APP_URL: \$\{NEXT_PUBLIC_APP_URL:\?/);
  assert.match(compose, /FIXI_DOMAIN:\?/);
});

test('chaque variable obligatoire du docker-compose figure dans .env.example', () => {
  const compose = read('deploy/vps/docker-compose.yml');
  const example = read('deploy/vps/.env.example');
  const required = [...compose.matchAll(/\$\{([A-Z0-9_]+):\?/g)].map(m => m[1]);
  assert.ok(required.length >= 4);
  const needed = [...required, 'AUTH_SECRET', 'PLATFORM_AUTH_SECRET', 'SUPPLIER_AUTH_SECRET', 'DELIVERY_AUTH_SECRET', 'DATA_ENCRYPTION_KEY', 'CRON_SECRET', 'PLATFORM_ADMIN_PASSWORD'];
  for (const k of new Set(needed)) assert.match(example, new RegExp(`^${k}=`, 'm'), k);
  assert.ok(!/INITIAL_ADMIN_PIN/.test(example), 'aucun PIN par défaut sur le serveur réel');
});

test('l’adresse du serveur de la caisse Windows et de l’app Android vient de FIXI_PUBLIC_URL', () => {
  assert.match(read('.github/workflows/windows-exe-build.yml'), /VITE_FIXI_SERVER: \$\{\{ vars\.FIXI_PUBLIC_URL \}\}/);
  assert.match(read('.github/workflows/android-apk.yml'), /vars\.FIXI_PUBLIC_URL/);
  assert.match(read('apps/windows-pos/src/CaisseV4.tsx'), /VITE_FIXI_SERVER/);
  assert.match(read('apps/windows-pos/src/atelier.tsx'), /VITE_FIXI_SERVER/);
});

test('la caisse Windows peut vendre : ses fonctions serveur sont activées par défaut sur le VPS', () => {
  const compose = read('deploy/vps/docker-compose.yml');
  for (const k of ['SALES', 'ORDERS', 'RETURNS', 'DEBT_PAYMENTS']) assert.match(compose, new RegExp(`FIXI_WINDOWS_${k}_ENABLED: \\$\\{FIXI_WINDOWS_${k}_ENABLED:-true\\}`), k);
});

test('chaque script cité dans le guide existe et est exécutable', () => {
  const guide = read('deploy/vps/GUIDE_HOSTINGER.md');
  const scripts = new Set([...guide.matchAll(/\.\/([a-z-]+\.sh)/g)].map(m => m[1]));
  assert.ok(scripts.size >= 4);
  for (const sc of scripts) {
    const p = path.join(root, 'deploy/vps', sc);
    assert.ok(fs.existsSync(p), sc);
    assert.ok(fs.statSync(p).mode & 0o100, `${sc} doit être exécutable`);
  }
});

test('les secrets et états du serveur ne partent jamais dans git', () => {
  const ignore = read('.gitignore');
  for (const p of ['.env', 'deploy/vps/.state/', 'deploy/vps/rclone/']) assert.ok(ignore.includes(p), p);
});

test('mise à jour automatique : nouvelle version, retour arrière, pause, fenêtre de nuit (faux docker)', { skip: process.platform === 'win32' }, () => {
  const out = execFileSync('bash', [path.join(root, 'tests/deploy-autodeploy.sh')], { encoding: 'utf8', timeout: 120000 });
  assert.match(out, /TOUT EST OK/);
  assert.ok(!/FAIL/.test(out), out);
});
