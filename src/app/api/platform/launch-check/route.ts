import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requirePlatformSession } from '@/lib/platform-auth';
import { bad, ok } from '@/lib/http';
import { launchChecks, launchScore } from '@/lib/launch-check';

/** Fixi Control → Santé : « Prêt pour la mise en ligne ? » */
export async function GET() {
  try {
    await requirePlatformSession();
    const now = Date.now();
    const [backup, restore, errors24h, platformAdmins, platformAdminsWithout2fa, shops, shopsWithRecovery, openProblems, settings] = await Promise.all([
      prisma.systemEvent.findFirst({ where: { kind: 'BACKUP_OK' }, orderBy: { lastAt: 'desc' }, select: { lastAt: true } }),
      prisma.systemEvent.findFirst({ where: { kind: 'RESTORE_TEST_OK' }, orderBy: { lastAt: 'desc' }, select: { lastAt: true } }),
      prisma.systemEvent.count({ where: { kind: 'SERVER_ERROR', resolvedAt: null, lastAt: { gte: new Date(now - 86400_000) } } }),
      prisma.platformAdmin.count({ where: { isActive: true } }),
      prisma.platformAdmin.count({ where: { isActive: true, totpEnabled: false } }),
      prisma.shop.count({ where: { isActive: true } }),
      prisma.shop.count({ where: { isActive: true, users: { some: { role: UserRole.ADMIN, isActive: true, recoveryCodeHash: { not: null } } } } }),
      prisma.problemReport.count({ where: { status: 'OPEN' } }),
      prisma.platformSettings.findUnique({ where: { id: 'platform' }, select: { supportEmail: true, supportPhone: true } }),
    ]);
    const checks = launchChecks(process.env, {
      backupAgeHours: backup ? (now - backup.lastAt.getTime()) / 3600_000 : null,
      restoreOkAgeDays: restore ? (now - restore.lastAt.getTime()) / 86400_000 : null,
      errors24h, platformAdmins, platformAdminsWithout2fa, shops, shopsWithoutRecovery: Math.max(0, shops - shopsWithRecovery), openProblems, hasContact: !!(settings?.supportEmail || settings?.supportPhone),
    });
    return ok({ checks, score: launchScore(checks) });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
