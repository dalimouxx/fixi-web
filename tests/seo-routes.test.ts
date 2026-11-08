import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

test('le plan du site et robots.txt sont calculés à chaque requête (pas figés à la construction)', () => {
  assert.match(read('src/app/sitemap.ts'), /export const dynamic\s*=\s*'force-dynamic'/);
  assert.match(read('src/app/robots.ts'), /export const dynamic\s*=\s*'force-dynamic'/);
});

test('robots.txt annonce le plan du site à l’adresse publique', async () => {
  const prev = process.env.NEXT_PUBLIC_APP_URL;
  process.env.NEXT_PUBLIC_APP_URL = 'https://fixiphone.io/';
  try {
    const { default: robots } = await import('../src/app/robots');
    const r = robots() as any;
    assert.equal(r.sitemap, 'https://fixiphone.io/sitemap.xml');
    assert.ok(r.rules[0].disallow.includes('/app/'));
  } finally { if (prev === undefined) delete process.env.NEXT_PUBLIC_APP_URL; else process.env.NEXT_PUBLIC_APP_URL = prev; }
});
