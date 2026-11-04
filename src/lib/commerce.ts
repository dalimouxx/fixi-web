/** 17.7 — règles pures : demandes de pièces, clients qui décrochent, préparation au scanner, encaissements à venir. */
const DAY = 86400_000;

export const REQUEST_HOURS = 72;
export const DELAYS: Record<string, string> = { TODAY: 'Aujourd’hui', H24: 'Sous 24 h', H48: 'Sous 48 h', WEEK: 'Cette semaine' };

/** Un fournisseur voit la demande si elle est nationale ou s'il est dans la même région (comparaison sans accents). */
export function requestVisible(scope: string, requestRegion: string | null | undefined, supplierRegion: string | null | undefined) {
  if (scope === 'ALL') return true;
  const n = (x?: string | null) => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  return !!n(requestRegion) && n(requestRegion) === n(supplierRegion);
}

export function validPartRequest(b: any): { ok: true; value: { partName: string; deviceModel: string | null; quantity: number; note: string | null; scope: 'REGION' | 'ALL' } } | { ok: false; error: string } {
  const partName = String(b?.partName || '').trim().replace(/\s+/g, ' ');
  const quantity = Math.trunc(Number(b?.quantity || 1));
  if (partName.length < 3 || partName.length > 120) return { ok: false, error: 'Décrivez la pièce (3 à 120 caractères)' };
  if (!(quantity >= 1 && quantity <= 500)) return { ok: false, error: 'Quantité : 1 à 500' };
  return { ok: true, value: { partName, deviceModel: String(b?.deviceModel || '').trim().slice(0, 80) || null, quantity, note: String(b?.note || '').trim().slice(0, 300) || null, scope: b?.scope === 'ALL' ? 'ALL' : 'REGION' } };
}

/**
 * Client qui décroche : au moins 3 commandes sur 120 jours, et rien depuis plus de 2× son rythme habituel
 * (minimum 21 jours). Renvoie null si le client est régulier.
 */
export function churnRisk(orderDates: (Date | string)[], now = Date.now()) {
  const t = orderDates.map(d => new Date(d).getTime()).filter(x => now - x <= 120 * DAY).sort((a, b) => a - b);
  if (t.length < 3) return null;
  const gaps = t.slice(1).map((x, i) => x - t[i]);
  const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const silent = now - t[t.length - 1];
  const threshold = Math.max(21 * DAY, 2 * avg);
  if (silent < threshold) return null;
  return { orders: t.length, everyDays: Math.max(1, Math.round(avg / DAY)), silentDays: Math.floor(silent / DAY), lastAt: new Date(t[t.length - 1]) };
}

export type PickLine = { itemId: string; productId: string; name: string; quantity: number; codes: string[]; location?: string | null };

/** Ordre de préparation : par emplacement (A1, A2, B1…), puis par nom ; les pièces sans emplacement à la fin. */
export function pickOrder(lines: PickLine[]) {
  return [...lines].sort((a, b) => (a.location ? 0 : 1) - (b.location ? 0 : 1) || String(a.location || '').localeCompare(String(b.location || ''), 'fr', { numeric: true }) || a.name.localeCompare(b.name, 'fr'));
}

/** Applique un scan : renvoie la ligne touchée ou l'erreur (pièce étrangère à la commande, quantité déjà atteinte). */
export function applyScan(lines: PickLine[], picked: Record<string, number>, code: string): { ok: true; itemId: string; picked: Record<string, number> } | { ok: false; error: string } {
  const c = code.trim().toLowerCase();
  if (!c) return { ok: false, error: 'Code vide' };
  const matches = lines.filter(l => l.codes.some(x => x && x.trim().toLowerCase() === c));
  if (!matches.length) return { ok: false, error: 'Cette pièce ne fait pas partie de la commande' };
  const line = matches.find(l => (picked[l.itemId] || 0) < l.quantity);
  if (!line) return { ok: false, error: `${matches[0].name} : quantité déjà complète` };
  return { ok: true, itemId: line.itemId, picked: { ...picked, [line.itemId]: (picked[line.itemId] || 0) + 1 } };
}

export const pickingDone = (lines: PickLine[], picked: Record<string, number>) => lines.every(l => (picked[l.itemId] || 0) >= l.quantity);

/** Répartit des montants dans le temps : en retard, cette semaine, ce mois-ci, plus tard. */
export function bucketize(items: { amount: number; at: Date | string | null }[], now = Date.now()) {
  const out = { overdue: 0, week: 0, month: 0, later: 0 };
  for (const i of items) {
    if (!(i.amount > 0)) continue;
    const t = i.at ? new Date(i.at).getTime() : now;
    const k = t < now - DAY / 2 ? 'overdue' : t <= now + 7 * DAY ? 'week' : t <= now + 31 * DAY ? 'month' : 'later';
    out[k] += i.amount;
  }
  for (const k of Object.keys(out) as (keyof typeof out)[]) out[k] = Math.round(out[k] * 1000) / 1000;
  return out;
}
