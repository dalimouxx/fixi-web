// Rapport du mois : bornes du mois et texte court envoyé au gérant.
export function monthRange(ym: string) {
  const m = /^(\d{4})-(\d{2})$/.exec(ym); if (!m) throw new Error('Mois invalide');
  const start = new Date(Number(m[1]), Number(m[2]) - 1, 1);
  const end = new Date(Number(m[1]), Number(m[2]), 1);
  return { start, end };
}
export function previousMonth(d = new Date()) { const x = new Date(d.getFullYear(), d.getMonth() - 1, 1); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`; }
export function monthLabel(ym: string, locale = 'fr-FR') { const { start } = monthRange(ym); return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(start); }

export function monthlyText(x: { shop: string; ym: string; revenue: string; profit?: string | null; repairs: number; delivered: number; topIssue?: string | null; link: string }) {
  return `${x.shop} — rapport de ${monthLabel(x.ym)}\n`
    + `Encaissé : ${x.revenue}${x.profit ? ` · Bénéfice : ${x.profit}` : ''}\n`
    + `${x.repairs} réparations reçues · ${x.delivered} rendues${x.topIssue ? ` · panne n°1 : ${x.topIssue}` : ''}\n`
    + `Rapport complet (PDF) : ${x.link}`;
}
