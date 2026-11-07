/**
 * Réassort intelligent : vitesse de sortie sur les 28 derniers jours (ventes comptoir + pièces posées),
 * jours de stock restants et quantité à commander pour tenir 14 jours.
 */
export type RestockItem = { id: string; name: string; sku: string; quantity: number; minQuantity: number };
export type Outflow = { inventoryItemId: string; quantityChange: number };

export function restockPlan(items: RestockItem[], outflows: Outflow[], windowDays = 28, targetDays = 14) {
  const out = new Map<string, number>();
  for (const m of outflows) if (m.quantityChange < 0) out.set(m.inventoryItemId, (out.get(m.inventoryItemId) || 0) - m.quantityChange);
  return items.map(i => {
    const sold = out.get(i.id) || 0;
    const perDay = sold / windowDays;
    const perWeek = Math.round(perDay * 7 * 10) / 10;
    const daysLeft = perDay > 0 ? Math.floor(i.quantity / perDay) : null;
    const need = Math.max(Math.ceil(perDay * targetDays) - i.quantity, i.quantity <= i.minQuantity ? Math.max(1, i.minQuantity * 2 - i.quantity) : 0, 0);
    const urgency = i.quantity <= 0 && sold > 0 ? 3 : daysLeft !== null && daysLeft <= 3 ? 2 : (daysLeft !== null && daysLeft <= 7) || i.quantity <= i.minQuantity ? 1 : 0;
    return { ...i, sold28: sold, perWeek, daysLeft, suggested: need, urgency };
  }).filter(x => x.urgency > 0 && x.suggested > 0).sort((a, b) => b.urgency - a.urgency || (a.daysLeft ?? 999) - (b.daysLeft ?? 999));
}

export function restockSentence(x: { perWeek: number; quantity: number; daysLeft: number | null; suggested: number }) {
  const sells = x.perWeek > 0 ? `Vous en sortez ${String(x.perWeek).replace('.', ',')} par semaine` : 'Stock sous le seuil';
  const left = x.quantity <= 0 ? 'il n’en reste plus' : `il en reste ${x.quantity}${x.daysLeft !== null ? ` (≈ ${x.daysLeft} j)` : ''}`;
  return `${sells}, ${left}. À commander : ${x.suggested}.`;
}
