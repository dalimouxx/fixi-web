import { bad, ok } from '@/lib/http';
import { recordEvent } from '@/lib/alerts';

/**
 * Le script de sauvegarde (deploy/vps/backup) rend compte ici après chaque passage.
 * Corps : { kind: 'BACKUP_OK'|'BACKUP_FAIL'|'RESTORE_TEST_OK'|'RESTORE_TEST_FAIL', message, details }
 * Une sauvegarde réussie n'envoie pas d'alerte (seulement les échecs et les tests de restauration).
 */
const KINDS = new Set(['BACKUP_OK', 'BACKUP_FAIL', 'RESTORE_TEST_OK', 'RESTORE_TEST_FAIL']);
export async function POST(req: Request) {
  try {
    if (!process.env.CRON_SECRET || req.headers.get('x-cron-secret') !== process.env.CRON_SECRET) return bad('Accès refusé', 403);
    const b = await req.json().catch(() => ({}));
    const kind = String(b.kind || '');
    if (!KINDS.has(kind)) return bad('Type inconnu');
    const details = typeof b.details === 'object' && b.details ? b.details : {};
    await recordEvent(kind as any, String(b.message || kind).slice(0, 500), details, { where: 'sauvegarde', alert: kind !== 'BACKUP_OK' });
    return ok({ ok: true });
  } catch (e: any) { return bad(e.message, 500); }
}
