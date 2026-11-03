import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad, ok } from '@/lib/http';
import { cleanImei, isImei } from '@/lib/imei';

// Un IMEI a-t-il été signalé perdu ou volé dans le réseau Fixi ? On ne révèle jamais quel atelier l'a signalé.
export async function GET(req: Request) {
  try {
    const s = await requireSession();
    const imei = cleanImei(new URL(req.url).searchParams.get('imei') || '');
    if (!isImei(imei)) return ok({ valid: false, flagged: false });
    const rows = await prisma.imeiReport.findMany({ where: { imei, resolvedAt: null }, select: { shopId: true, reason: true, createdAt: true }, orderBy: { createdAt: 'desc' } });
    const others = rows.filter(r => r.shopId !== s.shopId);
    return ok({ valid: true, flagged: others.length > 0, reports: others.length, reason: others[0]?.reason || null, lastAt: others[0]?.createdAt || null, reportedByMe: rows.some(r => r.shopId === s.shopId) });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
