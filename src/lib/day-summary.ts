// Résumé du jour en une phrase, en tête de l'accueil de l'atelier.
const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

export function daySummary(x: { lang?: string; ready: number; waiting: number; active: number; revenue?: string | null; pickups?: number }) {
  const ar = x.lang === 'ar';
  const parts: string[] = [];
  if (ar) {
    if (x.ready) parts.push(`${x.ready} جهاز للتسليم`);
    if (x.pickups) parts.push(`${x.pickups} حريف للتذكير`);
    if (x.waiting) parts.push(`${x.waiting} بانتظار قطعة`);
    if (!x.ready && !x.waiting && x.active) parts.push(`${x.active} إصلاح جارٍ`);
    if (x.revenue) parts.push(`${x.revenue} مقبوضة`);
    return parts.length ? `اليوم: ${parts.join('، ')}.` : 'اليوم: لا شيء عاجل. كل شيء محدّث.';
  }
  if (x.ready) parts.push(plural(x.ready, 'appareil à rendre', 'appareils à rendre'));
  if (x.pickups) parts.push(plural(x.pickups, 'client à relancer', 'clients à relancer'));
  if (x.waiting) parts.push(plural(x.waiting, 'pièce à recevoir', 'pièces à recevoir'));
  if (!x.ready && !x.waiting && x.active) parts.push(plural(x.active, 'réparation en cours', 'réparations en cours'));
  if (x.revenue) parts.push(`${x.revenue} encaissés`);
  if (!parts.length) return 'Aujourd’hui : rien d’urgent, tout est à jour.';
  const last = parts.pop()!;
  return `Aujourd’hui : ${parts.length ? parts.join(', ') + ' et ' : ''}${last}.`;
}
