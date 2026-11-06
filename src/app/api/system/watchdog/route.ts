import { prisma } from '@/lib/prisma';
import { bad, ok } from '@/lib/http';
import { recordEvent } from '@/lib/alerts';

/**
 * Surveillance horaire (appelée par instrumentation.ts ou un cron externe, avec x-cron-secret).
 * Si les sauvegardes sont activées (BACKUP_EXPECTED=on) et qu'aucune n'a réussi depuis 26 h : alerte.
 */
export async function POST(req: Request) {
  try {
    if (!process.env.CRON_SECRET || req.headers.get('x-cron-secret') !== process.env.CRON_SECRET) return bad('Accès refusé', 403);
    const out: Record<string, unknown> = {};
    if (process.env.BACKUP_EXPECTED === 'on') {
      const last = await prisma.systemEvent.findFirst({ where: { kind: 'BACKUP_OK' }, orderBy: { lastAt: 'desc' } });
      const age = last ? (Date.now() - last.lastAt.getTime()) / 3600_000 : Infinity;
      out.lastBackupHours = Number.isFinite(age) ? Math.round(age) : null;
      if (age > 26) await recordEvent('BACKUP_MISSING', last ? `Dernière sauvegarde réussie il y a ${Math.round(age)} h.` : 'Aucune sauvegarde réussie enregistrée.', {}, { where: 'watchdog' });
    }
    return ok(out);
  } catch (e: any) { return bad(e.message, 500); }
}
