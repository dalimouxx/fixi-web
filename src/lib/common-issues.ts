// Pannes les plus fréquentes, proposées en un toucher à la réception.
// Si l'atelier a déjà une panne du même nom dans « Pannes & prix », son prix est repris.
export type QuickIssue = { name: string; icon: string; price?: number | null; typeId?: string };

const COMMON: Record<string, { name: string; icon: string }[]> = {
  PHONE: [
    { name: 'Écran cassé', icon: 'screen' },
    { name: 'Batterie', icon: 'battery' },
    { name: 'Connecteur de charge', icon: 'plug' },
    { name: 'Ne s’allume pas', icon: 'power' },
    { name: 'Oxydation / eau', icon: 'water' },
    { name: 'Caméra', icon: 'camera' },
    { name: 'Haut-parleur / micro', icon: 'speaker' },
    { name: 'Logiciel / bloqué', icon: 'software' },
  ],
  TABLET: [
    { name: 'Écran cassé', icon: 'screen' },
    { name: 'Batterie', icon: 'battery' },
    { name: 'Connecteur de charge', icon: 'plug' },
    { name: 'Ne s’allume pas', icon: 'power' },
    { name: 'Logiciel / bloqué', icon: 'software' },
  ],
  LAPTOP: [
    { name: 'Écran cassé', icon: 'screen' },
    { name: 'Batterie', icon: 'battery' },
    { name: 'Ne s’allume pas', icon: 'power' },
    { name: 'Clavier', icon: 'keyboard' },
    { name: 'Lent / virus', icon: 'software' },
    { name: 'Oxydation / eau', icon: 'water' },
  ],
};

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’']/g, '').toLowerCase().trim();

export function quickIssues(types: any[] | null | undefined, category: string, max = 10): QuickIssue[] {
  const own = (types || []).filter(t => t && t.category === category && t.active !== false);
  const priceOf = (t: any) => (t.fixedPrice != null && t.fixedPrice !== '' ? Number(t.fixedPrice) : null);
  const out: QuickIssue[] = [];
  const seen = new Set<string>();
  for (const c of COMMON[category] || COMMON.PHONE) {
    const match = own.find(t => norm(t.name).includes(norm(c.name)) || norm(c.name).includes(norm(t.name)));
    out.push({ ...c, price: match ? priceOf(match) : null, typeId: match?.id });
    seen.add(norm(c.name));
    if (match) seen.add(norm(match.name));
  }
  // Les pannes propres à l'atelier passent ensuite.
  for (const t of own) {
    if (seen.has(norm(t.name))) continue;
    seen.add(norm(t.name));
    out.push({ name: t.name, icon: 'wrench', price: priceOf(t), typeId: t.id });
  }
  return out.slice(0, max);
}
