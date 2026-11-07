/** Boutiques à surveiller (Fixi Control) : règles pures, testables. */
export type WatchInput = { id: string; createdAt: Date; setupCompletedAt: Date | null; lastSeenAt: Date | null; repairs14d: number; subEndsAt: Date | null; openProblems: number };
export type WatchReason = { code: 'NEVER_SETUP' | 'INACTIVE' | 'NO_REPAIRS' | 'EXPIRING' | 'EXPIRED' | 'PROBLEMS'; label: string; weight: number };
const DAY = 86400_000;

export function watchReasons(s: WatchInput, now = Date.now()): WatchReason[] {
  const out: WatchReason[] = [];
  const age = now - s.createdAt.getTime();
  if (!s.setupCompletedAt && age > 2 * DAY) out.push({ code: 'NEVER_SETUP', label: `Inscrite il y a ${Math.floor(age / DAY)} j, jamais configurée`, weight: 3 });
  const seen = s.lastSeenAt?.getTime() ?? null;
  if ((seen === null && age > 7 * DAY) || (seen !== null && now - seen > 7 * DAY)) out.push({ code: 'INACTIVE', label: seen === null ? 'Jamais connectée' : `Aucune activité depuis ${Math.floor((now - seen) / DAY)} j`, weight: 3 });
  if (s.setupCompletedAt && age > 14 * DAY && s.repairs14d === 0) out.push({ code: 'NO_REPAIRS', label: 'Aucune réparation en 14 jours', weight: 2 });
  if (s.subEndsAt) {
    const left = s.subEndsAt.getTime() - now;
    if (left < 0) out.push({ code: 'EXPIRED', label: `Abonnement expiré depuis ${Math.ceil(-left / DAY)} j`, weight: 3 });
    else if (left < 7 * DAY) out.push({ code: 'EXPIRING', label: `Abonnement : fin dans ${Math.ceil(left / DAY)} j`, weight: 2 });
  }
  if (s.openProblems > 0) out.push({ code: 'PROBLEMS', label: `${s.openProblems} problème(s) signalé(s) ouvert(s)`, weight: 2 });
  return out;
}
