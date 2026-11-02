import { prisma } from '@/lib/prisma';
import { bad, ok } from '@/lib/http';
import { cleanPhone, cleanText } from '@/lib/supplier-invite';
import { clientIp } from '@/lib/login-guard';

const hits = new Map<string, { n: number; at: number }>();

// Le fournisseur invité demande son espace : Fixi Control voit la demande et crée le compte.
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const ip = clientIp(req); const now = Date.now(); const h = hits.get(ip);
    if (h && now - h.at < 3600_000 && h.n >= 10) return bad('Trop de demandes. Réessayez plus tard.', 429);
    hits.set(ip, h && now - h.at < 3600_000 ? { n: h.n + 1, at: h.at } : { n: 1, at: now });
    const { code } = await params;
    const inv = await prisma.supplierInvite.findUnique({ where: { code } });
    if (!inv) return bad('Invitation introuvable', 404);
    if (inv.status === 'CONVERTED') return ok({ status: inv.status });
    const b = await req.json().catch(() => ({}));
    const requestName = cleanText(b.name, 80), requestCompany = cleanText(b.company, 100), requestCity = cleanText(b.city, 60), requestPhone = cleanPhone(b.phone);
    if (requestName.length < 2 || requestCompany.length < 2) return bad('Indiquez votre nom et le nom de votre société');
    if (!requestPhone) return bad('Numéro de téléphone invalide');
    const x = await prisma.supplierInvite.update({ where: { id: inv.id }, data: { status: 'REQUESTED', requestName, requestCompany, requestPhone, requestCity: requestCity || null, requestedAt: new Date() }, select: { status: true } });
    return ok(x);
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
