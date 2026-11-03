import { APK_URL } from '@/lib/apk';

export const dynamic = 'force-dynamic';

// Sert l'APK depuis l'adresse de Fixi (au lieu de rediriger vers GitHub) :
// type « application Android » et nom de fichier explicites, pour que tous les navigateurs
// (Chrome, Brave, navigateur Huawei, onglets ouverts depuis WhatsApp) terminent bien le téléchargement.
export async function GET() {
  try {
    const r = await fetch(APK_URL, { redirect: 'follow', cache: 'no-store' });
    if (!r.ok || !r.body) throw new Error(String(r.status));
    const headers = new Headers({
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Disposition': 'attachment; filename="Fixi.apk"',
      'Cache-Control': 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    });
    const len = r.headers.get('content-length');
    if (len) headers.set('Content-Length', len);
    return new Response(r.body, { headers });
  } catch {
    return Response.redirect(APK_URL, 302);
  }
}
