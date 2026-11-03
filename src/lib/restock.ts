// Réapprovisionnement conseillé : ce que les ateliers commandent par semaine, et combien racheter
// pour tenir « coverWeeks » semaines en gardant le stock minimum.
export function restockSuggestion(x: { weeklyQty: number[]; stock: number; reserved?: number; minStock?: number; coverWeeks?: number }) {
  const weeks = x.weeklyQty.length || 1;
  const avg = x.weeklyQty.reduce((a, b) => a + b, 0) / weeks;
  const available = Math.max(0, x.stock - (x.reserved || 0));
  const target = Math.ceil(avg * (x.coverWeeks ?? 2)) + (x.minStock || 0);
  const qty = Math.max(0, target - available);
  const weeksLeft = avg > 0 ? Math.round((available / avg) * 10) / 10 : null;
  return { avgPerWeek: Math.round(avg * 10) / 10, available, suggested: qty, weeksLeft, urgent: weeksLeft !== null && weeksLeft < 1 };
}
