// Ancienneté d'une réparation : depuis combien de jours elle n'a pas bougé.
// Orange après 3 jours sans changement, rouge après 7. Les appareils rendus ou annulés ne comptent pas.
export const AGE_WARN_DAYS = 3;
export const AGE_LATE_DAYS = 7;
const DONE = ['DELIVERED', 'CANCELLED'];

export type AgeLevel = 'ok' | 'warn' | 'late';

export function repairAge(r: { status: string; updatedAt?: string | Date | null; createdAt?: string | Date | null }, now: Date = new Date()) {
  const ref = r.updatedAt || r.createdAt;
  if (!ref || DONE.includes(r.status)) return { days: 0, level: 'ok' as AgeLevel, label: '' };
  const days = Math.max(0, Math.floor((now.getTime() - new Date(ref).getTime()) / 86400000));
  const level: AgeLevel = days >= AGE_LATE_DAYS ? 'late' : days >= AGE_WARN_DAYS ? 'warn' : 'ok';
  const label = level === 'ok' ? '' : `${days} j sans changement`;
  return { days, level, label };
}
