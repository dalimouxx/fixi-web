/** Monetary invariants for supplier / workshop / courier settlements.
 * Amounts are integer millimes (1 TND = 1000 millimes); never use floating-point currency.
 * This module does not persist payments or authorize collectors.
 */
export type SettlementEntry = Readonly<{
  id: string;
  amountMillimes: number;
  status: "PENDING" | "CONFIRMED" | "REVERSED";
  collector: "SUPPLIER" | "DRIVER";
  remittedToSupplier: boolean;
}>;

function validMoney(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError("Amount must be a nonnegative safe integer in millimes");
  }
}

/** Derive balances from confirmed receipts, not from mutable cached totals. */
export function settlementBalances(invoiceMillimes: number, entries: readonly SettlementEntry[]) {
  validMoney(invoiceMillimes);
  const ids = new Set<string>();
  let paidMillimes = 0;
  let driverHeldMillimes = 0;
  for (const entry of entries) {
    if (!entry.id || ids.has(entry.id)) throw new Error("Duplicate or missing settlement ID");
    ids.add(entry.id);
    validMoney(entry.amountMillimes);
    if (entry.status !== "CONFIRMED") continue;
    paidMillimes += entry.amountMillimes;
    if (entry.collector === "DRIVER" && !entry.remittedToSupplier) {
      driverHeldMillimes += entry.amountMillimes;
    }
    if (!Number.isSafeInteger(paidMillimes) || !Number.isSafeInteger(driverHeldMillimes)) {
      throw new RangeError("Settlement total overflow");
    }
  }
  if (paidMillimes > invoiceMillimes) throw new RangeError("Overpayment requires a separate credit workflow");
  return {
    paidMillimes,
    remainingMillimes: invoiceMillimes - paidMillimes,
    driverHeldMillimes,
  };
}
