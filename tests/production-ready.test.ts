import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import zlib from 'node:zlib';
import { buildZip, crc32, toCsv } from '../src/lib/zip';
import { newRecoveryCode, normalizeRecoveryCode, temporaryPin } from '../src/lib/recovery';
import { fingerprint } from '../src/lib/alerts';

test('Alertes : même erreur = même empreinte (nombres et identifiants ignorés)', () => {
  assert.equal(fingerprint('SERVER_ERROR', 'Repair F-2635409 introuvable', '/api/repairs/1'), fingerprint('SERVER_ERROR', 'Repair F-9999999 introuvable', '/api/repairs/7'));
  assert.notEqual(fingerprint('SERVER_ERROR', 'A', 'x'), fingerprint('CLIENT_ERROR', 'A', 'x'));
});

test('Export : ZIP valide (CRC, décompression) et CSV pour Excel', () => {
  assert.equal(crc32(Buffer.from('hello')), 0x3610a686);
  const zip = buildZip([{ name: 'a.csv', data: 'x;y\r\n1;2' }, { name: 'b.json', data: '{"ok":true}' }]);
  assert.equal(zip.readUInt32LE(0), 0x04034b50);
  const nameLen = zip.readUInt16LE(26), compLen = zip.readUInt32LE(18);
  assert.equal(zlib.inflateRawSync(zip.subarray(30 + nameLen, 30 + nameLen + compLen)).toString(), 'x;y\r\n1;2');
  const csv = toCsv([{ nom: 'Sami; "le pro"', n: 2 }]);
  assert.ok(csv.startsWith('﻿nom;n') && csv.includes('"Sami; ""le pro"""'));
});

test('Code de secours : format lisible, saisie tolérante, PIN temporaire', () => {
  const c = newRecoveryCode();
  assert.match(c, /^FIXI-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  assert.equal(normalizeRecoveryCode(c.toLowerCase().replace(/-/g, ' ')), c.slice(5).replace(/-/g, ''));
  assert.match(temporaryPin(), /^\d{6}$/);
});

test('Production : alertes serveur sans casser le runtime edge, routes protégées', () => {
  const inst = readFileSync('src/instrumentation.ts', 'utf8');
  assert.match(inst, /if \(process\.env\.NEXT_RUNTIME === 'nodejs'\) \{\s*try \{\s*const \{ reportServerError \} = await import\('\.\/lib\/alerts'\)/, 'import seulement dans le bloc nodejs');
  assert.ok(inst.includes("/api/system/watchdog"));
  for (const p of ['src/app/api/system/watchdog/route.ts', 'src/app/api/system/backup-status/route.ts']) assert.ok(readFileSync(p, 'utf8').includes("req.headers.get('x-cron-secret') !== process.env.CRON_SECRET"), p);
  const rec = readFileSync('src/app/api/auth/recover/route.ts', 'utf8');
  assert.ok(rec.includes("loginGuard('recover'") && rec.includes('recoveryCodeHash: null') && rec.includes('UserRole.ADMIN'));
  const exp = readFileSync('src/app/api/export/full/route.ts', 'utf8');
  assert.ok(exp.includes('requireSession([UserRole.ADMIN]') && exp.includes('publicToken|walletToken|pinHash|recoveryCodeHash'));
  assert.ok(readFileSync('src/app/api/platform/shops/[id]/reset-pin/route.ts', 'utf8').includes('mustChangePin: true'));
});

test('Sauvegardes : scripts, chiffrement, test de restauration, VPS et GitHub', () => {
  for (const f of ['fixi-backup.sh', 'fixi-restore-test.sh', 'fixi-restore.sh']) {
    const p = `scripts/backup/${f}`; const s = readFileSync(p, 'utf8');
    assert.ok(statSync(p).mode & 0o111, `${f} exécutable`); assert.ok(s.includes('pgurl()'), `${f} retire ?schema=`);
  }
  assert.ok(readFileSync('scripts/backup/fixi-backup.sh', 'utf8').includes('--cipher-algo AES256'));
  assert.ok(readFileSync('scripts/backup/fixi-restore-test.sh', 'utf8').includes('SELECT count(*) FROM "Shop"'));
  const compose = readFileSync('deploy/vps/docker-compose.yml', 'utf8');
  assert.ok(compose.includes('backup:') && compose.includes('caddy:') && compose.includes('BACKUP_EXPECTED: "on"'));
  const wf = readFileSync('.github/workflows/db-backup.yml', 'utf8');
  assert.ok(wf.includes('fixi-backup.sh') && wf.includes('fixi-restore-test.sh') && wf.includes('retention-days: 30'));
});
