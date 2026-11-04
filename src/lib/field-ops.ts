/** 17.6 — règles pures : relances de paiement, crédit, arrivée du livreur. Testables sans base. */

export const REMINDER_LEVELS = [7, 15, 30] as const;
const DAY = 86400_000;

export type DueSale = { id: string; total: number; paid: number; credit?: number; createdAt: Date | string; dueAt?: Date | string | null };

/** Reste à payer d'un client et âge de la plus ancienne facture non soldée (jours depuis l'échéance, sinon la date). */
export function aging(sales: DueSale[], now = Date.now()) {
  let due = 0, oldest = 0;
  for (const s of sales) {
    const rest = Math.max(0, Number(s.total) - Number(s.credit || 0) - Number(s.paid));
    if (rest <= 0.0005) continue;
    due += rest;
    const ref = new Date(s.dueAt || s.createdAt).getTime();
    oldest = Math.max(oldest, Math.floor((now - ref) / DAY));
  }
  return { due: Math.round(due * 1000) / 1000, days: Math.max(0, oldest) };
}

/** Palier de relance atteint : 0 (rien), 7, 15 ou 30 jours. */
export function reminderLevel(days: number) {
  return [...REMINDER_LEVELS].reverse().find(l => days >= l) || 0;
}

/** Faut-il relancer automatiquement ? Une seule fois par palier, et jamais deux fois en 5 jours. */
export function shouldRemind(level: number, last: { level: number; at: Date | string } | null, now = Date.now()) {
  if (!level) return false;
  if (!last) return true;
  if (now - new Date(last.at).getTime() < 5 * DAY) return false;
  return level > last.level;
}

export function reminderText(level: number, v: { customer: string; supplier: string; due: string; days: number }) {
  if (level >= 30) return `Bonjour ${v.customer}, votre solde chez ${v.supplier} est de ${v.due}, en retard de ${v.days} jours. Merci de le régler rapidement pour continuer à commander à crédit.`;
  if (level >= 15) return `Bonjour ${v.customer}, petit rappel : ${v.due} restent à régler chez ${v.supplier} (${v.days} jours). Vous pouvez payer au prochain passage du livreur.`;
  return `Bonjour ${v.customer}, votre solde chez ${v.supplier} est de ${v.due}. Merci et à bientôt !`;
}

/** Plafond de crédit : 0 = pas de plafond. Renvoie le montant qui dépasse (0 si la commande passe). */
export function creditOverflow(limit: number, currentDue: number, newAmount: number) {
  if (!(limit > 0)) return 0;
  return Math.max(0, Math.round((currentDue + newAmount - limit) * 1000) / 1000);
}

/** Distance à vol d'oiseau (km). */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371, r = (x: number) => (x * Math.PI) / 180;
  const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Temps d'arrivée estimé en ville : détour routier ×1,35, 24 km/h en moyenne, minimum 1 min. */
export function etaMinutes(km: number) {
  return Math.max(1, Math.round(((km * 1.35) / 24) * 60));
}

export const ETA_ALERT_MIN = 6;

/** Échecs de livraison qui relancent automatiquement une nouvelle tentative. */
export const RETRY_FAILURES = ['CUSTOMER_ABSENT', 'SHOP_CLOSED'] as const;
export const MAX_ATTEMPTS = 3;
