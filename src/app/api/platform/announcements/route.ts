import { NotificationType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requirePlatformSession } from '@/lib/platform-auth';
import { bad, ok } from '@/lib/http';
import { plain } from '@/lib/serializers';
import { ANN_AUDIENCES, ANN_TONES } from '@/lib/announcements';

export async function GET() {
  try { await requirePlatformSession(); return ok(plain(await prisma.platformAnnouncement.findMany({ orderBy: { createdAt: 'desc' }, take: 30 }))); }
  catch (e: any) { return bad(e.message, e.status || 500); }
}

/** Nouvelle annonce : { title, message, audience, region?, tone, days?, href?, notify? } */
export async function POST(req: Request) {
  try {
    const admin = await requirePlatformSession();
    const b = await req.json().catch(() => ({}));
    const title = String(b.title || '').trim().slice(0, 90), message = String(b.message || '').trim().slice(0, 400);
    if (title.length < 2 || message.length < 2) return bad('Titre et message requis');
    const audience = (ANN_AUDIENCES as readonly string[]).includes(b.audience) ? b.audience : 'ALL';
    const tone = (ANN_TONES as readonly string[]).includes(b.tone) ? b.tone : 'INFO';
    const days = Math.min(90, Math.max(0, Number(b.days) || 0));
    const href = typeof b.href === 'string' && /^(\/|https:\/\/)/.test(b.href) ? b.href.slice(0, 300) : null;
    const region = String(b.region || '').trim() || null;
    const row = await prisma.platformAnnouncement.create({ data: { title, message, audience, tone, region, href, endsAt: days ? new Date(Date.now() + days * 86400_000) : null, createdBy: admin.fullName } });
    let notified = 0;
    if (b.notify && (audience === 'ALL' || audience === 'SHOPS')) {
      const shops = await prisma.shop.findMany({ where: { isActive: true, ...(region ? { region } : {}) }, select: { id: true } });
      if (shops.length) notified = (await prisma.notification.createMany({ data: shops.map(s => ({ shopId: s.id, type: tone === 'WARNING' ? NotificationType.WARNING : tone === 'SUCCESS' ? NotificationType.SUCCESS : NotificationType.INFO, title, message, href })) })).count;
    }
    return ok(plain({ ...row, notified }), { status: 201 });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

/** Arrêter une annonce : { id } */
export async function PATCH(req: Request) {
  try {
    await requirePlatformSession();
    const b = await req.json().catch(() => ({}));
    await prisma.platformAnnouncement.update({ where: { id: String(b.id || '') }, data: { active: false } });
    return ok({ ok: true });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
