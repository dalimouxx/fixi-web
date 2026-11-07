/** Annonces Fixi Control : qui voit quoi. */
export const ANN_AUDIENCES = ['ALL', 'SHOPS', 'SUPPLIERS', 'DRIVERS'] as const;
export const ANN_TONES = ['INFO', 'SUCCESS', 'WARNING'] as const;
export type AnnSpace = 'shop' | 'supplier' | 'driver';
export const audiencesFor = (space: AnnSpace) => ['ALL', space === 'shop' ? 'SHOPS' : space === 'supplier' ? 'SUPPLIERS' : 'DRIVERS'];
export function spaceOf(path: string): AnnSpace | null {
  if (/^\/app(\/|$)/.test(path)) return 'shop';
  if (/^\/supplier(\/|$)/.test(path) && !path.startsWith('/supplier/login')) return 'supplier';
  if (/^\/delivery(\/|$)/.test(path) && !path.startsWith('/delivery/login')) return 'driver';
  return null;
}
export function activeWhere(now = new Date()) {
  return { active: true, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] };
}
