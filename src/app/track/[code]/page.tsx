import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { isHexColor } from '@/lib/brand-color';
import TrackClient from './track-client';

type Props = { params: Promise<{ code: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

// Aperçu du lien dans WhatsApp : nom et logo de l'atelier (aucune donnée du client).
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const slug = typeof sp.shop === 'string' ? sp.shop : '';
  const shop = slug ? await prisma.shop.findUnique({ where: { slug }, select: { name: true, slug: true, logoDataUrl: true } }).catch(() => null) : null;
  const name = shop?.name || 'Fixi';
  const image = shop?.logoDataUrl ? `/api/public/shop-logo/${encodeURIComponent(shop.slug)}` : '/icons/atelier-512.png';
  const base = process.env.NEXT_PUBLIC_APP_URL;
  return {
    title: `Suivi de réparation · ${name}`,
    description: `Suivez l’avancement de votre réparation chez ${name}.`,
    robots: { index: false, follow: false },
    ...(base ? { metadataBase: new URL(base) } : {}),
    openGraph: { title: `Votre réparation chez ${name}`, description: 'Étape en cours, date prévue et reste à payer.', images: [{ url: image, width: 512, height: 512 }], type: 'website' },
  };
}

export async function generateViewport({ searchParams }: Props) {
  const sp = await searchParams;
  const slug = typeof sp.shop === 'string' ? sp.shop : '';
  const shop = slug ? await prisma.shop.findUnique({ where: { slug }, select: { brandColor: true } }).catch(() => null) : null;
  return { themeColor: isHexColor(shop?.brandColor) ? shop!.brandColor! : '#c2500a' };
}

export default function Page() {
  return <TrackClient />;
}
