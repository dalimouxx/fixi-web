import { prisma } from '@/lib/prisma';

// Logo de l'atelier servi comme une vraie image : WhatsApp l'affiche dans l'aperçu du lien de suivi.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const shop = await prisma.shop.findUnique({ where: { slug }, select: { logoDataUrl: true } }).catch(() => null);
  const m = shop?.logoDataUrl?.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
  if (!m) return Response.redirect(new URL('/icons/atelier-512.png', _req.url), 302);
  return new Response(Buffer.from(m[2], 'base64'), {
    headers: { 'Content-Type': m[1], 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff' },
  });
}
