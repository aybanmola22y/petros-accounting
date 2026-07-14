import type { MockExpenseTransaction } from "@/lib/mock-data/expenses";
import type { AccountingBasis } from "./types";

/** Resolve paid vs pending for ledger posting when QuickBooks import has no status column. */
export function expenseLedgerStatus(
  expense: MockExpenseTransaction,
): "paid" | "pending" {
  if (expense.status === "paid" || expense.status === "pending") {
    return expense.status;
  }
  return expense.type.trim().toLowerCase() === "bill" ? "pending" : "paid";
}

export function expenseIncludedForBasis(
  expense: MockExpenseTransaction,
  basis: AccountingBasis,
): boolean {
  if (expense.status) {
    if (basis === "Cash") return expense.status === "paid";
    return expense.status === "paid" || expense.status === "pending";
  }
  const type = expense.type.trim().toLowerCase();
  if (basis === "Cash") return type !== "bill";
  return true;
}

export function expenseCountsAsCashOutflow(expense: MockExpenseTransaction): boolean {
  return expenseLedgerStatus(expense) === "paid";
}
