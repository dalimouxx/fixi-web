import { headers } from 'next/headers';
import { prisma } from './prisma';
import { getPlatformSession } from './platform-auth';

/**
 * Mode maintenance + garde-fous des requêtes API authentifiées.
 * Appelé par requireSession / requireSupplierSession / requireDeliverySession :
 *  - maintenance active → les API répondent 503 (sauf super admin connecté à Fixi Control) ;
 *  - mode support « lecture seule » → toute écriture est refusée.
 * Les pages ne sont jamais bloquées ici (l'écran de maintenance est affiché par MaintenanceGate).
 */
export type MaintenanceState = { enabled: boolean; message: string | null; until: string | null; startedAt: string | null };
let cache: { at: number; v: MaintenanceState } | null = null;
const TTL = 10_000;

export async function getMaintenance(force = false): Promise<MaintenanceState> {
  if (!force && cache && Date.now() - cache.at < TTL) return cache.v;
  const s = await prisma.platformSettings.findUnique({ where: { id: 'platform' }, select: { maintenanceEnabled: true, maintenanceMessage: true, maintenanceUntil: true, maintenanceStartedAt: true } }).catch(() => null);
  const v: MaintenanceState = { enabled: !!s?.maintenanceEnabled, message: s?.maintenanceMessage || null, until: s?.maintenanceUntil?.toISOString() || null, startedAt: s?.maintenanceStartedAt?.toISOString() || null };
  cache = { at: Date.now(), v };
  return v;
}
export function clearMaintenanceCache() { cache = null; }

const WRITE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Garde commune des API authentifiées (le middleware pose x-fixi-api et x-fixi-method). */
export async function apiGuard(session: { support?: string; supportRo?: boolean } | null | undefined) {
  let h: Headers;
  try { h = await headers(); } catch { return; }
  if (h.get('x-fixi-api') !== '1') return;
  if (session?.supportRo && WRITE.has(String(h.get('x-fixi-method') || '').toUpperCase()))
    throw Object.assign(new Error('Mode support en lecture seule : aucune modification possible.'), { status: 403 });
  const m = await getMaintenance();
  if (!m.enabled) return;
  if (await getPlatformSession().catch(() => null)) return; // le super admin continue de travailler
  throw Object.assign(new Error(m.message || 'Fixi est en maintenance pour quelques minutes. Merci de patienter.'), { status: 503, code: 'MAINTENANCE' });
}
