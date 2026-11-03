import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad, ok } from '@/lib/http';
import { RepairStatus } from '@prisma/client';
import { issueFamily, normModel, priceStats } from '@/lib/price-hint';

// Prix pratiqué dans le réseau pour cette panne sur ce modèle (12 derniers mois).
// Aucun atelier n'est nommé et rien ne s'affiche sous 3 ateliers différents.
export async function GET(req: Request) {
  try {
    await requireSession();
    const u = new URL(req.url);
    const model = normModel(u.searchParams.get('model'));
    const family = issueFamily(u.searchParams.get('issue'));
    if (model.length < 2 || !family) return ok({ hint: null });
    const rows = await prisma.repair.findMany({
      where: { model: { equals: model, mode: 'insensitive' }, finalPrice: { not: null }, status: { in: [RepairStatus.READY, RepairStatus.DELIVERED] }, createdAt: { gte: new Date(Date.now() - 365 * 86400000) } },
      select: { finalPrice: true, shopId: true, reportedIssue: true }, take: 2000, orderBy: { createdAt: 'desc' },
    });
    const same = rows.filter(r => issueFamily(r.reportedIssue) === family).map(r => ({ price: Number(r.finalPrice), shopId: r.shopId }));
    return ok({ hint: priceStats(same) }, { headers: { 'Cache-Control': 'private, max-age=600' } });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
