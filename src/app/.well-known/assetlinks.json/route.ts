// Lien de confiance entre le site et l'application Android Fixi (Trusted Web Activity) :
// sans lui, l'application affiche une barre d'adresse. Empreinte(s) SHA-256 dans TWA_SHA256 (séparées par des virgules).
export const dynamic = 'force-dynamic';
export function GET() {
  const fingerprints = String(process.env.TWA_SHA256 || '').split(',').map(s => s.trim().toUpperCase()).filter(s => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(s));
  const packageName = process.env.TWA_PACKAGE_ID || 'tn.fixi.app';
  const body = fingerprints.length ? [{ relation: ['delegate_permission/common.handle_all_urls'], target: { namespace: 'android_app', package_name: packageName, sha256_cert_fingerprints: fingerprints } }] : [];
  return Response.json(body, { headers: { 'Cache-Control': 'public, max-age=3600' } });
}
