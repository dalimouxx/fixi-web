import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { validAlertPhone, platformWhatsAppReady } from '../src/lib/platform-whatsapp';

const root = path.join(__dirname, '..');

test('numéro WhatsApp fournisseur : tunisien local ou international', () => {
  assert.equal(validAlertPhone('21 555 497'), '21621555497');
  assert.equal(validAlertPhone('+216 21 555 497'), '21621555497');
  assert.equal(validAlertPhone('123'), null);
  assert.equal(validAlertPhone(''), null);
});

test('sans configuration WhatsApp plateforme, aucun envoi', () => {
  delete process.env.WHATSAPP_PLATFORM_TOKEN;
  assert.equal(platformWhatsAppReady(), false);
});

test('la notification de nouvelle commande peut confirmer la commande', () => {
  const sw = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');
  assert.ok(sw.includes("action==='accept-order'"));
  assert.ok(sw.includes("status:'CONFIRMED'"));
  const notif = fs.readFileSync(path.join(root, 'src/lib/supplier-notifications.ts'), 'utf8');
  assert.ok(notif.includes("action:'accept-order'"));
});

test('les vidéos d’aide de 30 s et leurs images existent', () => {
  for (const n of ['fixi-installer', 'fixi-alertes']) {
    for (const ext of ['mp4', 'jpg']) assert.ok(fs.existsSync(path.join(root, 'public/videos', `${n}.${ext}`)), `${n}.${ext}`);
    assert.ok(fs.statSync(path.join(root, 'public/videos', `${n}.mp4`)).size < 2_000_000, 'vidéo légère pour mobile');
  }
});

test('le mode gros caractères est appliqué avant l’affichage', () => {
  const layout = fs.readFileSync(path.join(root, 'src/app/layout.tsx'), 'utf8');
  assert.ok(layout.includes("fixi-text-size"));
  const css = fs.readFileSync(path.join(root, 'src/app/fixi-design-system.css'), 'utf8');
  assert.ok(css.includes('html[data-text="large"] body{zoom:1.15}'));
});
