/** Commissions techniciens : % de la marge (prix payé − coût des pièces) des réparations rendues sur la période. */
export type CommissionRepair = { technicianId: string | null; finalPrice: number | null; discountAmount: number; partsCost: number };
export function commissionFor(repairs: CommissionRepair[], rate: number | null) {
  const revenue = repairs.reduce((a, r) => a + Math.max(0, Number(r.finalPrice || 0) - Number(r.discountAmount || 0)), 0);
  const parts = repairs.reduce((a, r) => a + Number(r.partsCost || 0), 0);
  const margin = Math.max(0, revenue - parts);
  const r3 = (n: number) => Math.round(n * 1000) / 1000;
  return { count: repairs.length, revenue: r3(revenue), parts: r3(parts), margin: r3(margin), rate: rate ?? 0, commission: r3(margin * (rate ?? 0) / 100) };
}
export function monthRange(ym?: string | null) {
  const m = ym && /^\d{4}-\d{2}$/.test(ym) ? ym : new Date().toISOString().slice(0, 7);
  const [y, mo] = m.split('-').map(Number);
  return { month: m, start: new Date(Date.UTC(y, mo - 1, 1) - 3600_000), end: new Date(Date.UTC(y, mo, 1) - 3600_000) };
}
