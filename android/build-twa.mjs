// Génère le projet Android (Trusted Web Activity) de Fixi à partir de l'application web en ligne.
// Utilisé par .github/workflows/android-apk.yml ; peut aussi tourner sur un poste avec Android SDK.
//   TWA_HOST=fixi-xxx.onrender.com node android/build-twa.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TwaGenerator, TwaManifest, ConsoleLog } from '@bubblewrap/core';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const out = path.join(here, 'build');
const host = (process.env.TWA_HOST || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
if (!host) { console.error('TWA_HOST manquant (ex. fixi.onrender.com)'); process.exit(1); }
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const [maj, min, pat] = String(pkg.version).split('.').map(n => Number(n) || 0);

// Petit serveur local pour fournir les icônes au générateur (pas besoin que le site soit en ligne).
const server = http.createServer((req, res) => {
  const f = path.join(root, 'public', decodeURIComponent(String(req.url).split('?')[0]));
  if (!f.startsWith(path.join(root, 'public')) || !fs.existsSync(f)) { res.statusCode = 404; return res.end(); }
  res.setHeader('Content-Type', f.endsWith('.png') ? 'image/png' : 'application/octet-stream');
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const local = `http://127.0.0.1:${server.address().port}`;

const manifest = new TwaManifest({
  packageId: process.env.TWA_PACKAGE_ID || 'tn.fixi.app',
  host,
  name: 'Fixi',
  launcherName: 'Fixi',
  display: 'standalone',
  orientation: 'portrait',
  themeColor: '#c2500a',
  themeColorDark: '#1d1d1f',
  navigationColor: '#ffffff',
  navigationColorDark: '#1d1d1f',
  navigationDividerColor: '#e6eaf0',
  navigationDividerColorDark: '#1d1d1f',
  backgroundColor: '#ffffff',
  enableNotifications: true,
  startUrl: '/login',
  iconUrl: `${local}/icons/atelier-512.png`,
  maskableIconUrl: `${local}/icons/atelier-maskable-512.png`,
  monochromeIconUrl: `${local}/icons/badge-96.png`,
  splashScreenFadeOutDuration: 300,
  signingKey: { path: path.join(here, 'fixi.keystore'), alias: 'fixi' },
  appVersionName: pkg.version,
  appVersionCode: maj * 10000 + min * 100 + pat,
  shortcuts: [
    { name: 'Nouvelle réparation', shortName: 'Réception', url: '/app/repairs/new', chosenIconUrl: `${local}/icons/atelier-192.png` },
    { name: 'Espace fournisseur', shortName: 'Fournisseur', url: '/supplier', chosenIconUrl: `${local}/icons/supplier-192.png` },
    { name: 'Fixi Livreur', shortName: 'Livreur', url: '/delivery', chosenIconUrl: `${local}/icons/delivery-192.png` },
  ],
  generatorApp: 'fixi-build-twa',
  fallbackType: 'customtabs',
  features: {},
  alphaDependencies: { enabled: false },
  enableSiteSettingsShortcut: true,
  isChromeOSOnly: false,
  isMetaQuest: false,
  fullScopeUrl: `https://${host}/`,
  minSdkVersion: 21,
});

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
await new TwaGenerator().createTwaProject(out, manifest, new ConsoleLog('twa'));
fs.writeFileSync(path.join(out, 'twa-manifest.json'), JSON.stringify(manifest.toJson(), null, 2));
server.closeAllConnections?.(); server.close();
console.log(`Projet Android généré dans ${out} pour https://${host}/`);
process.exit(0);
