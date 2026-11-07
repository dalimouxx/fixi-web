/** Plusieurs pannes dans une réparation (écran + batterie + connecteur…), chacune avec son prix. */
export type RepairIssue = { name: string; price: number | null };

export function cleanIssues(raw: unknown): RepairIssue[] {
  const out: RepairIssue[] = [];
  for (const x of Array.isArray(raw) ? raw : []) {
    const name = String((x as any)?.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (name.length < 2 || out.some(i => i.name.toLowerCase() === name.toLowerCase())) continue;
    const p = (x as any)?.price;
    const price = p === null || p === undefined || p === '' ? null : Math.round(Number(String(p).replace(',', '.')) * 1000) / 1000;
    out.push({ name, price: price !== null && Number.isFinite(price) && price >= 0 ? price : null });
    if (out.length >= 10) break;
  }
  return out;
}

/** Texte lisible partout (ticket, SMS, suivi) : « Écran + Batterie — tactile mort ». */
export function issuesText(list: RepairIssue[], note?: string | null) {
  const t = list.map(i => i.name).join(' + ');
  const n = String(note || '').trim();
  return t && n ? `${t} — ${n}` : t || n;
}

/** Total des prix connus (null si aucune panne n'a de prix). */
export function issuesTotal(list: RepairIssue[]) {
  const known = list.filter(i => i.price !== null);
  return known.length ? Math.round(known.reduce((a, i) => a + (i.price as number), 0) * 1000) / 1000 : null;
}
