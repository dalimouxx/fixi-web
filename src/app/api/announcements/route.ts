import { prisma } from '@/lib/prisma';
import { ok } from '@/lib/http';
import { getSession } from '@/lib/auth';
import { activeWhere, audiencesFor, type AnnSpace } from '@/lib/announcements';

export const dynamic = 'force-dynamic';

/** Annonces actives pour un espace (atelier : filtrées par région). */
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get('space');
  const space: AnnSpace = raw === 'supplier' || raw === 'driver' ? raw : 'shop';
  let region: string | null = null;
  if (space === 'shop') {
    const s = await getSession().catch(() => null);
    if (s) region = (await prisma.shop.findUnique({ where: { id: s.shopId }, select: { region: true } }).catch(() => null))?.region || null;
  }
  const rows = await prisma.platformAnnouncement.findMany({
    where: { ...activeWhere(), audience: { in: audiencesFor(space) }, AND: [{ OR: [{ region: null }, ...(region ? [{ region }] : [])] }] },
    orderBy: { startsAt: 'desc' }, take: 3,
    select: { id: true, tone: true, title: true, message: true, href: true },
  }).catch(() => []);
  return ok(rows, { headers: { 'cache-control': 'no-store' } });
}
