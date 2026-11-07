import { prisma } from '@/lib/prisma';
import { requirePlatformSession } from '@/lib/platform-auth';
import { bad, ok } from '@/lib/http';
import { plain } from '@/lib/serializers';
import { alertChannels, sendAlert } from '@/lib/alerts';

/** Santé de la plateforme : sauvegardes, test de restauration, erreurs regroupées, canaux d'alerte. */
export async function GET() {
  try {
    await requirePlatformSession();
    const [backup, backupFail, restore, errors, last24] = await Promise.all([
      prisma.systemEvent.findFirst({ where: { kind: 'BACKUP_OK' }, orderBy: { lastAt: 'desc' } }),
      prisma.systemEvent.findFirst({ where: { kind: 'BACKUP_FAIL', resolvedAt: null }, orderBy: { lastAt: 'desc' } }),
      prisma.systemEvent.findFirst({ where: { kind: { in: ['RESTORE_TEST_OK', 'RESTORE_TEST_FAIL'] } }, orderBy: { lastAt: 'desc' } }),
      prisma.systemEvent.findMany({ where: { kind: { in: ['SERVER_ERROR', 'CLIENT_ERROR', 'BACKUP_FAIL', 'BACKUP_MISSING', 'RESTORE_TEST_FAIL'] }, resolvedAt: null }, orderBy: { lastAt: 'desc' }, take: 40 }),
      prisma.systemEvent.count({ where: { kind: { in: ['SERVER_ERROR', 'CLIENT_ERROR'] }, lastAt: { gte: new Date(Date.now() - 86400_000) }, resolvedAt: null } }),
    ]);
    return ok(plain({ channels: alertChannels(), backupExpected: process.env.BACKUP_EXPECTED === 'on', backup, backupFail, restore, errors, errorsLast24h: last24 }));
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

/** Actions : { action: 'test-alert' } ou { action: 'resolve', id } (problème corrigé : on le range). */
export async function POST(req: Request) {
  try {
    await requirePlatformSession();
    const b = await req.json().catch(() => ({}));
    if (b.action === 'test-alert') {
      const sent = await sendAlert('🔔 Test depuis Fixi Control : les alertes arrivent bien sur ce canal.');
      return sent ? ok({ ok: true }) : bad('Aucun canal configuré ou envoi impossible (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID ou ALERT_WEBHOOK_URL).', 400);
    }
    if (b.action === 'resolve' && b.id) { await prisma.systemEvent.update({ where: { id: String(b.id) }, data: { resolvedAt: new Date() } }); return ok({ ok: true }); }
    if (b.action === 'resolve-all') { const r = await prisma.systemEvent.updateMany({ where: { kind: { in: ['SERVER_ERROR', 'CLIENT_ERROR'] }, resolvedAt: null }, data: { resolvedAt: new Date() } }); return ok({ resolved: r.count }); }
    return bad('Action inconnue');
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
