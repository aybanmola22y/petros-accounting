import {
  AGING_BUCKET_LABELS,
  AGING_DETAIL_BUCKET_ORDER,
  bucketKeyForDaysPastDue,
  type AgingBucketKey,
  type ArAgingDetailLine,
  type ArAgingDetailSection,
} from "@/lib/ar-aging-from-receivables";
import type { ImportedApAgingDetailLine } from "@/lib/ap-aging-detail-import";
import { parseTransactionDate } from "@/lib/ledger/date-utils";
import { unpaidBillsFromExpenseTransactions } from "@/lib/ledger/compute-supplier-dashboard";
import type { MockExpenseTransaction } from "@/lib/mock-data/expenses";
import type { UnpaidBill } from "@/lib/mock-data/unpaid-bills";
import { applyUnpaidBillStatusAsOf } from "@/lib/mock-data/unpaid-bills";
import {
  daysBetween,
  formatReportDateShort,
  parseReportDate,
  startOfDay,
} from "@/lib/report-date-utils";

function moneyKey(value: number): string {
  return Math.round(Math.abs(value) * 100).toString();
}

function supplierKey(name: string): string {
  return name.trim().toLowerCase();
}

type ExpenseBillRef = {
  number: string;
  date: string;
  total: number;
  payee: string;
};

function expenseBillRefs(
  expenses: readonly MockExpenseTransaction[],
): ExpenseBillRef[] {
  const refs: ExpenseBillRef[] = [];
  for (const expense of expenses) {
    if (expense.type.trim().toLowerCase() !== "bill") continue;
    const number = expense.number.trim();
    if (!number) continue;
    refs.push({
      number,
      date: expense.date,
      total: expense.total,
      payee: expense.payee,
    });
  }
  return refs;
}

/**
 * Attach expense Bill "No." onto unpaid bills.
 * Match supplier + original bill amount (not due date — unpaid due date ≠ expense bill date).
 */
function enrichBillNoFromExpenses(
  bills: UnpaidBill[],
  expenses: readonly MockExpenseTransaction[],
): UnpaidBill[] {
  const refs = expenseBillRefs(expenses);
  if (refs.length === 0) return bills;

  const bySupplierAmount = new Map<string, ExpenseBillRef[]>();
  const bySupplier = new Map<string, ExpenseBillRef[]>();

  for (const ref of refs) {
    const sKey = supplierKey(ref.payee);
    const amountKey = `${sKey}|${moneyKey(ref.total)}`;
    const amountList = bySupplierAmount.get(amountKey) ?? [];
    amountList.push(ref);
    bySupplierAmount.set(amountKey, amountList);

    const supplierList = bySupplier.get(sKey) ?? [];
    supplierList.push(ref);
    bySupplier.set(sKey, supplierList);
  }

  const usedNumbers = new Set<string>();

  function takeRef(candidates: ExpenseBillRef[] | undefined): ExpenseBillRef | undefined {
    if (!candidates?.length) return undefined;
    const available = candidates.filter((ref) => !usedNumbers.has(ref.number));
    const pick = available[0] ?? candidates[0];
    if (!pick) return undefined;
    usedNumbers.add(pick.number);
    return pick;
  }

  return bills.map((bill) => {
    if (bill.billNo?.trim()) return bill;

    const sKey = supplierKey(bill.supplier);
    let match = takeRef(bySupplierAmount.get(`${sKey}|${moneyKey(bill.billAmount)}`));
    if (!match && bill.openBalance > 0) {
      match = takeRef(bySupplierAmount.get(`${sKey}|${moneyKey(bill.openBalance)}`));
    }
    if (!match) {
      const forSupplier = (bySupplier.get(sKey) ?? []).filter(
        (ref) => !usedNumbers.has(ref.number),
      );
      if (forSupplier.length === 1) match = takeRef(forSupplier);
    }

    if (!match) return bill;
    return {
      ...bill,
      billNo: match.number,
      billDate: bill.billDate || match.date,
    };
  });
}

/** Merge stored unpaid bills with open Bills from the expenses ledger. */
export function resolveUnpaidBillsForApAging(
  unpaidBills: readonly UnpaidBill[],
  expenses: readonly MockExpenseTransaction[],
  asOf: Date,
): UnpaidBill[] {
  const storeOpen = unpaidBills
    .filter((bill) => bill.openBalance > 0)
    .map((bill) => applyUnpaidBillStatusAsOf(bill, asOf));

  if (storeOpen.length > 0) {
    return enrichBillNoFromExpenses(storeOpen, expenses);
  }

  const fromExpenses = unpaidBillsFromExpenseTransactions(expenses, asOf)
    .filter((bill) => bill.openBalance > 0)
    .map((bill) => applyUnpaidBillStatusAsOf(bill, asOf));

  return enrichBillNoFromExpenses(fromExpenses, expenses);
}

export function buildApAgingDetailSectionsFromImport(
  importedLines: readonly ImportedApAgingDetailLine[],
  options?: {
    coalesceTo91Plus?: boolean;
    reportTotals?: { amount: number; openBalance: number };
  },
): ArAgingDetailSection[] {
  const coalesceTo91Plus = options?.coalesceTo91Plus ?? false;
  const lines: ArAgingDetailLine[] = importedLines.map((line, index) => ({
    id: `ap-import:${line.referenceNumber}:${line.transactionType}:${index}`,
    date: line.date,
    transactionType: line.transactionType,
    number: line.referenceNumber,
    customer: line.supplier.trim() || "Unknown supplier",
    location: line.location.trim(),
    dueDate: line.dueDate,
    amount: line.amount,
    openBalance: line.openBalance,
    pastDueDays: line.pastDueDays,
    bucket: (coalesceTo91Plus ? "days91plus" : line.bucket) as AgingBucketKey,
  }));

  const computedAmount = lines.reduce((sum, line) => sum + line.amount, 0);
  const computedOpen = lines.reduce((sum, line) => sum + line.openBalance, 0);
  const totals = {
    amount: options?.reportTotals?.amount ?? computedAmount,
    openBalance: options?.reportTotals?.openBalance ?? computedOpen,
  };

  return AGING_DETAIL_BUCKET_ORDER.map((bucket) => {
    const bucketLines = lines.filter((line) => line.bucket === bucket);
    const applyTotals =
      coalesceTo91Plus && bucket === "days91plus" && bucketLines.length > 0;
    return {
      bucket,
      label: AGING_BUCKET_LABELS[bucket],
      lines: bucketLines,
      amountSubtotal: applyTotals
        ? totals.amount
        : bucketLines.reduce((sum, line) => sum + line.amount, 0),
      openBalanceSubtotal: applyTotals
        ? totals.openBalance
        : bucketLines.reduce((sum, line) => sum + line.openBalance, 0),
    };
  }).filter((section) => section.lines.length > 0);
}

export function buildApAgingDetailSections(
  unpaidBills: readonly UnpaidBill[],
  expenses: readonly MockExpenseTransaction[],
  asOf: Date,
  options?: { coalesceTo91Plus?: boolean },
): ArAgingDetailSection[] {
  const asOfDay = startOfDay(asOf);
  const bills = resolveUnpaidBillsForApAging(unpaidBills, expenses, asOfDay);
  const coalesceTo91Plus = options?.coalesceTo91Plus ?? false;

  const lines: ArAgingDetailLine[] = bills.map((bill, index) => {
    const due = parseTransactionDate(bill.dueDate) ?? parseReportDate(bill.dueDate);
    const txnDate = bill.billDate
      ? (parseTransactionDate(bill.billDate) ?? parseReportDate(bill.billDate))
      : due;
    const daysPastDue = due ? daysBetween(due, asOfDay) : 999;
    const bucket = coalesceTo91Plus
      ? ("days91plus" as const)
      : bucketKeyForDaysPastDue(daysPastDue);

    return {
      id: `ap:${bill.id}:${index}`,
      date: txnDate ? formatReportDateShort(txnDate) : bill.billDate || bill.dueDate,
      transactionType: "Bill",
      number: bill.billNo?.trim() || "",
      customer: bill.supplier.trim() || "Unknown supplier",
      location: "",
      dueDate: due ? formatReportDateShort(due) : bill.dueDate,
      amount: bill.billAmount,
      openBalance: bill.openBalance,
      pastDueDays: due ? Math.max(0, daysPastDue) : undefined,
      bucket,
    };
  });

  return AGING_DETAIL_BUCKET_ORDER.map((bucket) => {
    const bucketLines = lines.filter((line) => line.bucket === bucket);
    return {
      bucket,
      label: AGING_BUCKET_LABELS[bucket],
      lines: bucketLines,
      amountSubtotal: bucketLines.reduce((sum, line) => sum + line.amount, 0),
      openBalanceSubtotal: bucketLines.reduce((sum, line) => sum + line.openBalance, 0),
    };
  }).filter((section) => section.lines.length > 0);
}
