import type { MetadataRoute } from 'next';

// Lu à chaque requête : l'adresse publique (NEXT_PUBLIC_APP_URL) n'est connue qu'au démarrage du serveur.
export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/app/', '/login', '/track/', '/queue', '/receipt/', '/api/'] }],
    ...(base ? { sitemap: `${base}/sitemap.xml` } : {}),
  };
}
