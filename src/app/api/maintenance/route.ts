import { ok } from '@/lib/http';
import { getMaintenance } from '@/lib/maintenance';
import { getPlatformSession } from '@/lib/platform-auth';

export const dynamic = 'force-dynamic';

/** État public de la maintenance (l'écran d'attente le consulte). Le super admin connecté n'est pas bloqué. */
export async function GET() {
  const m = await getMaintenance();
  const bypass = m.enabled ? !!(await getPlatformSession().catch(() => null)) : false;
  return ok({ ...m, bypass }, { headers: { 'cache-control': 'no-store' } });
}
