// Paiement en plusieurs fois : découpage et état de chaque échéance.
export function splitInstallments(total: number, count: number, first: Date, everyDays = 30) {
  const n = Math.max(2, Math.min(6, Math.trunc(count)));
  const cents = Math.round(total * 1000);
  const base = Math.floor(cents / n);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(first); d.setDate(d.getDate() + i * everyDays);
    const amount = (i === n - 1 ? cents - base * (n - 1) : base) / 1000;
    return { dueDate: d, amount };
  });
}

/** Les paiements déjà reçus couvrent les échéances dans l'ordre. */
export function installmentStatus(list: { id?: string; dueDate: Date | string; amount: number | string }[], paidTotal: number, now = new Date()) {
  let left = paidTotal;
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  return [...list].sort((a, b) => +new Date(a.dueDate) - +new Date(b.dueDate)).map(x => {
    const amount = Number(x.amount);
    const covered = Math.min(amount, Math.max(0, left)); left -= amount;
    const paid = covered >= amount - 0.0005;
    const due = new Date(x.dueDate);
    return { ...x, amount, covered, paid, remaining: Math.max(0, amount - covered), late: !paid && due < today, dueToday: !paid && due.toDateString() === today.toDateString() };
  });
}
