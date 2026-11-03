import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad, ok } from '@/lib/http';
import { UserRole } from '@prisma/client';
import { audit } from '@/lib/audit';
import { cleanImei, isImei } from '@/lib/imei';

// Signaler (ou retirer) un IMEI perdu / volé pour prévenir les autres ateliers.
export async function POST(req: Request) {
  try {
    const s = await requireSession([UserRole.ADMIN, UserRole.RECEPTION]);
    const b = await req.json().catch(() => ({}));
    const imei = cleanImei(b.imei || '');
    if (!isImei(imei)) return bad('IMEI invalide (15 chiffres)');
    const reason = b.reason === 'LOST' ? 'LOST' : 'STOLEN';
    const note = String(b.note || '').slice(0, 300) || null;
    const x = await prisma.imeiReport.upsert({ where: { imei_shopId: { imei, shopId: s.shopId } }, update: { reason, note, resolvedAt: null }, create: { imei, shopId: s.shopId, reason, note } });
    await audit(s.shopId, s.id, 'REPORT', 'IMEI', x.id, { reason });
    return ok({ ok: true });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

export async function DELETE(req: Request) {
  try {
    const s = await requireSession([UserRole.ADMIN, UserRole.RECEPTION]);
    const imei = cleanImei(new URL(req.url).searchParams.get('imei') || '');
    await prisma.imeiReport.updateMany({ where: { imei, shopId: s.shopId, resolvedAt: null }, data: { resolvedAt: new Date() } });
    return ok({ ok: true });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
