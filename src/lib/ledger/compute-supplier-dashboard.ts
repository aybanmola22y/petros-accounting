import { parseTransactionDate } from "@/lib/ledger/date-utils";
import { dashboardLedgerAnchor } from "@/lib/ledger/dashboard-ledger-anchor";
import type { MockExpenseTransaction } from "@/lib/mock-data/expenses";
import type { PaidBill, PaidBillsSummary } from "@/lib/mock-data/paid-bills";
import { computePaidLast30Days } from "@/lib/mock-data/paid-bills";
import type {
  SupplierPayablesSummary,
  UnpaidBill,
} from "@/lib/mock-data/unpaid-bills";
import {
  billsForSupplierList,
  computeSupplierPayablesSummary,
  prepareUnpaidBillsForSupplierDashboard,
} from "@/lib/mock-data/unpaid-bills";
import { startOfDay } from "@/lib/report-date-utils";

/** Build unpaid bills from QuickBooks expense rows (Type = Bill). */
export function unpaidBillsFromExpenseTransactions(
  expenses: readonly MockExpenseTransaction[],
  asOf = dashboardLedgerAnchor(),
): UnpaidBill[] {
  const today = startOfDay(asOf).getTime();

  return expenses
    .filter((expense) => expense.type.trim().toLowerCase() === "bill")
    .map((expense) => {
      const date = parseTransactionDate(expense.date);
      const overdue = date ? startOfDay(date).getTime() < today : false;
      return {
        id: expense.id,
        supplier: expense.payee,
        dueDate: expense.date,
        billAmount: expense.total,
        openBalance: expense.total,
        statusType: overdue ? ("overdue" as const) : ("due_later" as const),
        statusDetail: overdue ? "Overdue" : "Open",
        billNo: expense.number || undefined,
        category: expense.category || undefined,
      };
    });
}

/** Base payment types from the QuickBooks expenses export (not yet scoped to QB Suppliers KPI). */
export function isSupplierPaymentExpense(expense: MockExpenseTransaction): boolean {
  const type = expense.type.trim().toLowerCase();
  if (!expense.payee?.trim()) return false;

  if (type === "bill") return false;
  if (type.includes("purchase order")) return false;
  if (type.includes("supplier credit") || type.includes("credit card credit")) return false;

  if (type.includes("bill payment") || type.includes("bill pay")) return true;
  if (type === "check" || type === "cheque") return true;
  if (type === "expense") return true;

  return false;
}

/** Bill payments from QuickBooks expense import. */
export function paidBillsFromExpenseTransactions(
  expenses: readonly MockExpenseTransaction[],
): PaidBill[] {
  return expenses
    .filter(isSupplierPaymentExpense)
    .map((expense) => ({
      id: expense.id,
      supplier: expense.payee,
      dueDate: expense.date,
      billDate: expense.date,
      billAmount: Math.abs(expense.total),
      paidAmount: Math.abs(expense.total),
      paidDate: expense.date,
      billNo: expense.number || undefined,
    }));
}

export function mergeUnpaidBillsForSuppliers(
  storeBills: readonly UnpaidBill[],
  expenseBills: readonly UnpaidBill[],
): UnpaidBill[] {
  if (storeBills.length > 0) return [...storeBills];
  return [...expenseBills];
}

export function mergePaidBillsForSuppliers(
  storePaid: readonly PaidBill[],
  expensePaid: readonly PaidBill[],
): PaidBill[] {
  const byId = new Map<string, PaidBill>();
  for (const bill of storePaid) byId.set(bill.id, bill);
  for (const bill of expensePaid) byId.set(bill.id, bill);
  return [...byId.values()];
}

/** KPI strip on Suppliers — uses bills when available, else imported open balances. */
export function computeSupplierDashboardSummary(
  suppliers: ReadonlyArray<{ name: string; openBalance: number }>,
  unpaidBills: readonly UnpaidBill[],
  paidBills: readonly PaidBill[],
  asOf = dashboardLedgerAnchor(),
): SupplierPayablesSummary & { paid: PaidBillsSummary; usesSupplierBalances: boolean } {
  const supplierNames = suppliers.map((s) => s.name);
  const relevantBills = billsForSupplierList(supplierNames, [...unpaidBills]);

  if (relevantBills.length > 0) {
    const preparedBills = prepareUnpaidBillsForSupplierDashboard(unpaidBills, asOf);
    const base = computeSupplierPayablesSummary(suppliers, preparedBills);
    return {
      ...base,
      paid: computePaidLast30Days([...paidBills], asOf),
      usesSupplierBalances: false,
    };
  }

  const withBalance = suppliers.filter((s) => s.openBalance > 0);
  return {
    overdue: { amount: 0, count: 0 },
    openBills: {
      amount: withBalance.reduce((sum, s) => sum + s.openBalance, 0),
      count: withBalance.length,
    },
    paid: computePaidLast30Days([...paidBills], asOf),
    usesSupplierBalances: true,
  };
}
