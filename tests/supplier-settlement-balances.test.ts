import assert from "node:assert/strict";
import { test } from "node:test";
import { settlementBalances } from "../src/lib/supplier-settlement-balances";

test("partial supplier and driver receipts reduce workshop debt", () => {
  const result = settlementBalances(500_000, [
    { id: "driver-1", amountMillimes: 100_000, status: "CONFIRMED", collector: "DRIVER", remittedToSupplier: false },
    { id: "supplier-1", amountMillimes: 50_000, status: "CONFIRMED", collector: "SUPPLIER", remittedToSupplier: true },
  ]);
  assert.deepEqual(result, { paidMillimes: 150_000, remainingMillimes: 350_000, driverHeldMillimes: 100_000 });
});

test("pending receipts do not reduce debt", () => {
  assert.equal(settlementBalances(200_000, [
    { id: "pending", amountMillimes: 80_000, status: "PENDING", collector: "DRIVER", remittedToSupplier: false },
  ]).remainingMillimes, 200_000);
});

test("remitting driver cash changes custody, not workshop debt", () => {
  const receipt = { id: "receipt", amountMillimes: 60_000, status: "CONFIRMED" as const, collector: "DRIVER" as const };
  const before = settlementBalances(100_000, [{ ...receipt, remittedToSupplier: false }]);
  const after = settlementBalances(100_000, [{ ...receipt, remittedToSupplier: true }]);
  assert.equal(before.remainingMillimes, after.remainingMillimes);
  assert.equal(before.driverHeldMillimes, 60_000);
  assert.equal(after.driverHeldMillimes, 0);
});

test("rejects duplicate receipts and overpayments", () => {
  const item = { id: "same", amountMillimes: 100_000, status: "CONFIRMED" as const, collector: "SUPPLIER" as const, remittedToSupplier: true };
  assert.throws(() => settlementBalances(300_000, [item, item]));
  assert.throws(() => settlementBalances(50_000, [item]));
});
