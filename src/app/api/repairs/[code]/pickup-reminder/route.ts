import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad, ok } from '@/lib/http';
import { RepairStatus, UserRole } from '@prisma/client';
import { audit } from '@/lib/audit';
import { daysSince, pickupStage, readySince } from '@/lib/pickup-reminders';

// Note qu'une relance « appareil prêt » vient d'être envoyée (depuis le bouton WhatsApp de l'accueil).
export async function POST(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const s = await requireSession([UserRole.ADMIN, UserRole.RECEPTION, UserRole.CASHIER]);
    const { code } = await params;
    const r = await prisma.repair.findUnique({ where: { shopId_code: { shopId: s.shopId, code } }, include: { statusEvents: { where: { toStatus: RepairStatus.READY }, select: { toStatus: true, createdAt: true }, orderBy: { createdAt: 'asc' } } } });
    if (!r) return bad('Réparation introuvable', 404);
    if (r.status !== RepairStatus.READY) return bad('Cet appareil n’est plus en attente de récupération', 409);
    const since = readySince(r as any);
    const stage = Math.max(1, pickupStage(since ? daysSince(since) : 0));
    const x = await prisma.repair.update({ where: { id: r.id }, data: { pickupReminderCount: Math.max(r.pickupReminderCount, stage), pickupRemindedAt: new Date() }, select: { pickupReminderCount: true, pickupRemindedAt: true } });
    await audit(s.shopId, s.id, 'PICKUP_REMINDER', 'REPAIR', r.id, { stage, channel: 'whatsapp-link' });
    return ok(x);
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
