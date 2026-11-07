import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad, ok } from '@/lib/http';
import { daySummary, summaryText, tunisNow } from '@/lib/evening-summary';

/** Résumé d'une journée (gérant) : chiffres + texte prêt à partager. */
export async function GET(req: Request) {
  try {
    const s = await requireSession([UserRole.ADMIN]);
    const q = new URL(req.url).searchParams.get('jour');
    const day = q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : tunisNow().day;
    const shop = await prisma.shop.findUniqueOrThrow({ where: { id: s.shopId }, select: { name: true, currency: true, whatsappPhone: true, phone: true } });
    const sum = await daySummary(s.shopId, day);
    return ok({ ...sum, text: summaryText(shop.name, sum, shop.currency), currency: shop.currency, ownerPhone: shop.whatsappPhone || shop.phone || '' });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
