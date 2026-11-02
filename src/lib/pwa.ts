// Identité installable de chaque espace Fixi : un manifeste, une icône et un nom par espace,
// pour que le réparateur, le fournisseur, le livreur et l'équipe Fixi installent « leur » appli.
export type FixiSpace = 'atelier' | 'supplier' | 'delivery' | 'control';

type SpaceInfo = {
  name: string; shortName: string; description: string; startUrl: string; scope: string;
  manifest: string; background: string;
  shortcuts: { name: string; url: string; description: string }[];
};

export const spaces: Record<FixiSpace, SpaceInfo> = {
  atelier: {
    name: 'Fixi Atelier', shortName: 'Fixi Atelier', description: 'Réparations, caisse, clients et pièces de votre atelier.',
    startUrl: '/app/dashboard', scope: '/', manifest: '/manifest.webmanifest', background: '#f6f5f3',
    shortcuts: [
      { name: 'Nouvelle réparation', url: '/app/repairs/new', description: 'Enregistrer un appareil' },
      { name: 'Encaisser', url: '/app/cashier', description: 'Rendre un appareil prêt' },
      { name: 'Commander une pièce', url: '/app/suppliers', description: 'Chez vos fournisseurs' },
    ],
  },
  supplier: {
    name: 'Fixi Fournisseur', shortName: 'Fixi Fourn.', description: 'Commandes, caisse, stock et livraisons de votre société.',
    startUrl: '/supplier', scope: '/supplier', manifest: '/supplier/manifest.webmanifest', background: '#f6f5f3',
    shortcuts: [
      { name: 'Commandes', url: '/supplier?tab=orders', description: 'Commandes des boutiques' },
      { name: 'Vendre', url: '/supplier?tab=cashier', description: 'Ouvrir la caisse' },
      { name: 'Fin de journée', url: '/supplier/daily-report', description: 'Résumé du jour' },
    ],
  },
  delivery: {
    name: 'Fixi Livreur', shortName: 'Fixi Livreur', description: 'Missions, encaissements et preuves de livraison.',
    startUrl: '/delivery', scope: '/delivery', manifest: '/delivery/manifest.webmanifest', background: '#f6f5f3',
    shortcuts: [
      { name: 'Mes missions', url: '/delivery', description: 'Tournée du jour' },
      { name: 'Encaissements', url: '/delivery/encaissements', description: 'Argent à remettre' },
    ],
  },
  control: {
    name: 'Fixi Control', shortName: 'Fixi Control', description: 'Pilotage de la plateforme Fixi.',
    startUrl: '/saas', scope: '/saas', manifest: '/saas/manifest.webmanifest', background: '#f6f5f3',
    shortcuts: [],
  },
};

export const icon = (space: FixiSpace, kind: '192' | '512' | 'maskable-192' | 'maskable-512' | 'apple-180' | '48') => `/icons/${space}-${kind}.png`;
export const BADGE_ICON = '/icons/badge-96.png';

export function spaceForPath(pathname: string): FixiSpace {
  if (pathname.startsWith('/supplier')) return 'supplier';
  if (pathname.startsWith('/delivery')) return 'delivery';
  if (pathname.startsWith('/saas')) return 'control';
  return 'atelier';
}

export function buildManifest(space: FixiSpace) {
  const s = spaces[space];
  return {
    id: s.startUrl,
    name: s.name,
    short_name: s.shortName,
    description: s.description,
    lang: 'fr',
    dir: 'auto',
    start_url: s.startUrl,
    scope: s.scope,
    display: 'standalone',
    orientation: 'portrait',
    background_color: s.background,
    theme_color: s.background,
    categories: ['business', 'productivity'],
    icons: [
      { src: icon(space, '192'), sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: icon(space, '512'), sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: icon(space, 'maskable-192'), sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: icon(space, 'maskable-512'), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: s.shortcuts.map(x => ({ ...x, short_name: x.name, icons: [{ src: icon(space, '192'), sizes: '192x192', type: 'image/png' }] })),
  };
}

export function manifestResponse(space: FixiSpace) {
  return Response.json(buildManifest(space), {
    headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=3600' },
  });
}
