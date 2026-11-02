// Relance des appareils prêts non récupérés : 1re relance après 3 jours, 2e après 7 jours.
export const PICKUP_FIRST_DAYS = 3;
export const PICKUP_SECOND_DAYS = 7;

/** Nombre de relances qui devraient déjà avoir été faites après `days` jours. */
export function pickupStage(days: number) {
  return days >= PICKUP_SECOND_DAYS ? 2 : days >= PICKUP_FIRST_DAYS ? 1 : 0;
}

export function daysSince(d: Date | string, now: Date = new Date()) {
  return Math.max(0, Math.floor((now.getTime() - new Date(d).getTime()) / 86400000));
}

/** Date à laquelle l'appareil est devenu « Prêt » : dernier passage à READY, sinon dernière modification. */
export function readySince(r: { updatedAt?: Date | string | null; statusEvents?: { toStatus: string; createdAt: Date | string }[] }) {
  const ev = [...(r.statusEvents || [])].reverse().find(e => e.toStatus === 'READY');
  return ev?.createdAt ?? r.updatedAt ?? null;
}

/** Une relance est due si l'étape atteinte dépasse le nombre de relances déjà faites. */
export function pickupDue(days: number, alreadySent: number) {
  const stage = pickupStage(days);
  return stage > 0 && alreadySent < stage ? stage : 0;
}

type Vars = { client: string; device: string; code: string; shop: string; balance?: string; trackUrl?: string };

export function pickupMessage(stage: number, v: Vars, lang: 'fr' | 'ar' = 'fr') {
  const due = v.balance && v.balance !== '0' && !/^\u200E?0[\s,.]/.test(v.balance) ? v.balance : '';
  if (lang === 'ar') {
    const head = stage >= 2 ? `مرحباً ${v.client}، نذكّرك مرة أخرى أن جهازك ${v.device} جاهز منذ أسبوع.` : `مرحباً ${v.client}، جهازك ${v.device} جاهز وفي انتظارك.`;
    return `${head} الرمز: ${v.code}.${due ? ` المبلغ المتبقي: ${due}.` : ''}${v.trackUrl ? `\n${v.trackUrl}` : ''}\n${v.shop}`;
  }
  const head = stage >= 2
    ? `Bonjour ${v.client}, petit rappel : votre ${v.device} est prêt depuis une semaine et vous attend à l’atelier.`
    : `Bonjour ${v.client}, votre ${v.device} est prêt et vous attend à l’atelier.`;
  return `${head} Code : ${v.code}.${due ? ` Reste à payer : ${due}.` : ''}${v.trackUrl ? `\nSuivi : ${v.trackUrl}` : ''}\n${v.shop}`;
}

export function trackLink(base: string, shopSlug: string, code: string, token?: string | null) {
  if (!token) return '';
  return `${base.replace(/\/$/, '')}/track/${encodeURIComponent(code)}?shop=${encodeURIComponent(shopSlug)}&t=${encodeURIComponent(token)}`;
}
