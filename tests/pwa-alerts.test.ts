import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildManifest, spaces, spaceForPath, type FixiSpace } from '../src/lib/pwa';
import { fixiSounds, alertCategories, categoryFor, categoriesForSpace, parseAlertSettings, defaultAlertSettings, legacySoundMap, type FixiSoundId } from '../src/lib/notification-sounds';

const root = path.join(__dirname, '..');
const all = Object.keys(spaces) as FixiSpace[];

test('chaque espace a un manifeste installable (icônes PNG 192/512 + maskable, start_url dans le scope)', () => {
  const ids = new Set<string>();
  for (const s of all) {
    const m = buildManifest(s);
    assert.equal(m.display, 'standalone');
    assert.ok(m.start_url.startsWith(m.scope), s);
    ids.add(m.id);
    const sizes = m.icons.map(i => `${i.sizes}-${i.purpose}`);
    for (const need of ['192x192-any', '512x512-any', '192x192-maskable', '512x512-maskable']) assert.ok(sizes.includes(need), `${s} ${need}`);
    for (const i of m.icons) assert.ok(fs.existsSync(path.join(root, 'public', i.src)), i.src);
    assert.ok(fs.existsSync(path.join(root, 'public', 'icons', `${s}-apple-180.png`)), `${s} apple`);
  }
  assert.equal(ids.size, all.length, 'un identifiant unique par espace');
  assert.ok(fs.existsSync(path.join(root, 'public/icons/badge-96.png')));
});

test("l'espace est reconnu à partir de l'URL", () => {
  assert.equal(spaceForPath('/supplier?tab=orders'), 'supplier');
  assert.equal(spaceForPath('/delivery/encaissements'), 'delivery');
  assert.equal(spaceForPath('/saas'), 'control');
  assert.equal(spaceForPath('/app/dashboard'), 'atelier');
});

test('le service worker utilise des icônes PNG lisibles sur Android (plus de SVG dans les notifications)', () => {
  const sw = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');
  assert.doesNotThrow(() => new Function(sw));
  assert.ok(!/icon:'\/icon\.svg'|badge:'\/icon\.svg'/.test(sw));
  assert.ok(sw.includes('setAppBadge'));
  assert.ok(sw.includes('FIXI_SUMMARY'));
});

test('les sons sont distincts et dans la zone où un haut-parleur de téléphone est le plus fort', () => {
  const signatures = new Set<string>();
  for (const [id, s] of Object.entries(fixiSounds)) {
    if (id === 'silence') { assert.equal(s.notes.length, 0); continue; }
    signatures.add(JSON.stringify(s.notes));
    for (const [f, d, l] of s.notes) {
      assert.ok(f >= 900 && f <= 2400, `${id} ${f} Hz`);
      assert.ok(d >= 0 && d <= 1.2 && l > 0 && l <= .4, id);
    }
  }
  assert.equal(signatures.size, Object.keys(fixiSounds).length - 1);
});

test('nouvelle commande et nouvelle livraison ont des sons différents, répétés jusqu’à ouverture', () => {
  assert.notEqual(alertCategories.orders.defaultSound, alertCategories.missions.defaultSound);
  assert.ok(alertCategories.orders.repeat > 1 && alertCategories.missions.repeat > 1);
  assert.equal(categoryFor('SUPPLIER_NEW_ORDER'), 'orders');
  assert.equal(categoryFor('DRIVER_NEW_MISSION'), 'missions');
  assert.equal(categoryFor('SHOP_ORDER_DELIVERED'), 'done');
  assert.equal(categoryFor(undefined), 'general');
});

test('chaque espace ne montre que ses types d’alerte', () => {
  assert.ok(categoriesForSpace.supplier.includes('orders') && !categoriesForSpace.supplier.includes('missions'));
  assert.ok(categoriesForSpace.delivery.includes('missions') && !categoriesForSpace.delivery.includes('orders'));
});

test('les réglages d’alerte sont lus de façon sûre', () => {
  assert.deepEqual(parseAlertSettings(null), defaultAlertSettings());
  assert.deepEqual(parseAlertSettings('pas du json'), defaultAlertSettings());
  const s = parseAlertSettings(JSON.stringify({ volume: 7, vibrate: false, voice: true, sounds: { orders: 'radar', missions: 'inconnu' } }));
  assert.equal(s.volume, 1);
  assert.equal(s.vibrate, false);
  assert.equal(s.voice, true);
  assert.equal(s.sounds.orders, 'radar');
  assert.equal(s.sounds.missions, alertCategories.missions.defaultSound);
});

test('les anciens codes de son ont tous un équivalent', () => {
  for (const id of Object.values(legacySoundMap)) assert.ok((id as FixiSoundId) in fixiSounds);
});
