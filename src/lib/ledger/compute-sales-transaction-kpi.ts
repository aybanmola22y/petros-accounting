import { isDateInRange, parseTransactionDate } from "@/lib/ledger/date-utils";
import { addDays, startOfDay } from "@/lib/report-date-utils";
import { dashboardLedgerAnchor } from "@/lib/ledger/dashboard-ledger-anchor";
import {
  DEFAULT_INVOICE_PAYMENT_TERMS_DAYS,
  invoiceOpenBalance,
  isInvoiceDateInLookback,
  type InvoiceOpenBalanceRow,
} from "@/lib/ledger/invoice-open-balance";
import { salesTransactionOpenBalances } from "@/lib/ledger/invoices-from-sales-transactions";
import { INVOICE_UNPAID_LOOKBACK_DAYS } from "@/lib/mock-data/compute";
import type { MockSalesTransaction } from "@/lib/mock-data/sales";
import type { ImportedArAgingDetailLine } from "@/lib/ar-aging-detail-import";
import { normalizeInvoiceRef } from "@/lib/ledger/invoices-from-sales-transactions";
import { isArAgingSnapshotAsOfToday } from "@/lib/ar-aging-snapshot-utils";
import {
  salesTransactionListDateRange,
  type SalesTransactionDateFilter,
} from "@/lib/sales-transaction-list-date-filters";
import type { ReportDateRange } from "@/lib/report-date-utils";

export type SalesTransactionKpiId =
  | "estimates"
  | "unbilled"
  | "overdue"
  | "open"
  | "paid";

export type SalesTransactionKpiSegment = {
  id: SalesTransactionKpiId;
  amount: number;
  count: number;
  label: string;
  barClass: string;
  textClass: string;
  showCount: boolean;
};

export type SalesTransactionKpiSummary = {
  segments: SalesTransactionKpiSegment[];
};

export const SALES_RECENTLY_PAID_LOOKBACK_DAYS = 30;

function qbStatus(txn: MockSalesTransaction): string {
  return txn.qbStatus?.trim().toLowerCase() ?? "";
}

export function isVoidSalesTransaction(txn: MockSalesTransaction): boolean {
  const status = qbStatus(txn);
  const memo = txn.memo.trim().toLowerCase();
  return status === "void" || memo.includes("void");
}

function isUnpaidInvoiceStatus(status: string): boolean {
  return !["paid", "closed", "void"].includes(status);
}

function toInvoiceOpenRow(txn: MockSalesTransaction): InvoiceOpenBalanceRow {
  return {
    id: txn.id,
    date: txn.date,
    customer: txn.customer,
    amount: txn.amount,
    qbStatus: qbStatus(txn),
  };
}

function invoiceOpenAmount(
  txn: MockSalesTransaction,
  openBalances: ReadonlyMap<string, number>,
): number {
  if (txn.type !== "Invoice") return 0;
  return invoiceOpenBalance(toInvoiceOpenRow(txn), openBalances);
}

/** Partial invoices past net-14 due date — QuickBooks includes these in the overdue KPI bucket. */
function isPastDuePartialInvoice(
  txn: MockSalesTransaction,
  asOf: Date,
): boolean {
  if (qbStatus(txn) !== "partial") return false;
  const invoiceDate = parseTransactionDate(txn.date);
  if (!invoiceDate) return false;
  const dueDate = addDays(startOfDay(invoiceDate), DEFAULT_INVOICE_PAYMENT_TERMS_DAYS);
  return dueDate < startOfDay(asOf);
}

function kpiOverdueInvoiceAmount(
  txn: MockSalesTransaction,
  openBalances: ReadonlyMap<string, number>,
  arAgingInvoiceOpen: ReadonlyMap<string, { openBalance: number; bucket: ImportedArAgingDetailLine["bucket"] }> | null,
  asOf: Date,
): number {
  if (txn.type !== "Invoice") return 0;
  if (arAgingInvoiceOpen) {
    const key = normalizeInvoiceRef(txn.number);
    const match = key ? arAgingInvoiceOpen.get(key) : undefined;
    if (match) return match.openBalance;
  }
  if (isPastDuePartialInvoice(txn, asOf)) return Math.abs(txn.amount);
  return invoiceOpenAmount(txn, openBalances);
}

function kpiOpenInvoiceAmount(
  txn: MockSalesTransaction,
  openBalances: ReadonlyMap<string, number>,
  arAgingInvoiceOpen: ReadonlyMap<string, { openBalance: number; bucket: ImportedArAgingDetailLine["bucket"] }> | null,
): number {
  if (txn.type !== "Invoice") return 0;
  if (arAgingInvoiceOpen) {
    const key = normalizeInvoiceRef(txn.number);
    const match = key ? arAgingInvoiceOpen.get(key) : undefined;
    if (match) {
      if (qbStatus(txn) === "partial") return Math.abs(txn.amount);
      return match.openBalance;
    }
  }
  if (qbStatus(txn) === "partial") return Math.abs(txn.amount);
  return invoiceOpenAmount(txn, openBalances);
}

function matchesCustomerQuery(txn: MockSalesTransaction, customerQuery?: string): boolean {
  if (!customerQuery?.trim()) return true;
  return txn.customer.toLowerCase().includes(customerQuery.trim().toLowerCase());
}

/** Active estimates — pending/open in the last 365 days (QuickBooks sales KPI). */
export function isActiveEstimate(
  txn: MockSalesTransaction,
  asOf = dashboardLedgerAnchor(),
): boolean {
  if (txn.type !== "Estimate") return false;
  const status = qbStatus(txn);
  if (["expired", "applied", "closed", "void"].includes(status)) return false;
  if (!isInvoiceDateInLookback(txn.date, INVOICE_UNPAID_LOOKBACK_DAYS, asOf)) return false;
  return status === "pending" || status === "open" || status === "" || status === "accepted";
}

/** Overdue bucket — export status overdue only (QuickBooks sales KPI). */
export function isOverdueSalesInvoice(txn: MockSalesTransaction): boolean {
  if (txn.type !== "Invoice") return false;
  return qbStatus(txn) === "overdue";
}

export function isSalesArOverdueInvoice(
  txn: MockSalesTransaction,
  openBalances: ReadonlyMap<string, number>,
  asOf = dashboardLedgerAnchor(),
): boolean {
  if (txn.type !== "Invoice" || isVoidSalesTransaction(txn)) return false;
  if (!isInvoiceDateInLookback(txn.date, INVOICE_UNPAID_LOOKBACK_DAYS, asOf)) return false;
  if (invoiceOpenAmount(txn, openBalances) <= 0) return false;

  const status = qbStatus(txn);
  if (status === "overdue") return true;
  return status === "partial" && isPastDuePartialInvoice(txn, asOf);
}

export function isOpenSalesInvoiceOrCredit(txn: MockSalesTransaction): boolean {
  const status = qbStatus(txn);
  if (txn.type === "Invoice" && status === "open") return true;
  if (txn.type === "Credit Note" && status !== "paid" && status !== "closed") return true;
  return false;
}

/** Open AR bucket — all unpaid invoices with open balance in the last 365 days. */
export function isSalesArOpenInvoice(
  txn: MockSalesTransaction,
  openBalances: ReadonlyMap<string, number>,
  asOf = dashboardLedgerAnchor(),
): boolean {
  if (txn.type !== "Invoice" || isVoidSalesTransaction(txn)) return false;
  if (!isUnpaidInvoiceStatus(qbStatus(txn))) return false;
  if (!isInvoiceDateInLookback(txn.date, INVOICE_UNPAID_LOOKBACK_DAYS, asOf)) return false;
  return invoiceOpenAmount(txn, openBalances) > 0;
}

export function isOpenSalesCreditNote(txn: MockSalesTransaction): boolean {
  if (txn.type !== "Credit Note" || isVoidSalesTransaction(txn)) return false;
  const status = qbStatus(txn);
  return status !== "paid" && status !== "closed";
}

/** Open credit bucket — unpaid credit notes in the last 365 days (QuickBooks sales KPI). */
export function isSalesArOpenCreditNote(
  txn: MockSalesTransaction,
  asOf = dashboardLedgerAnchor(),
): boolean {
  if (!isOpenSalesCreditNote(txn)) return false;
  return isInvoiceDateInLookback(txn.date, INVOICE_UNPAID_LOOKBACK_DAYS, asOf);
}

export function isUnbilledSalesReceipt(txn: MockSalesTransaction): boolean {
  return (
    txn.type === "Sales receipt" &&
    ["open", "partial", "unbilled"].includes(qbStatus(txn))
  );
}

function recentPaidRange(asOf: Date): ReportDateRange {
  const to = startOfDay(asOf);
  const from = addDays(to, -SALES_RECENTLY_PAID_LOOKBACK_DAYS);
  return { from, to };
}

function isRecentlyPaidPaymentStatus(status: string): boolean {
  return status === "applied" || status === "closed" || status === "unapplied";
}

/** Recently paid amount — applied/unapplied payments in the last 30 days (inclusive). */
export function isRecentlyPaidSalesPaymentForAmount(
  txn: MockSalesTransaction,
  asOf = dashboardLedgerAnchor(),
): boolean {
  if (txn.type !== "Payment" || isVoidSalesTransaction(txn)) return false;
  if (!isRecentlyPaidPaymentStatus(qbStatus(txn))) return false;

  const date = parseTransactionDate(txn.date);
  return date ? isDateInRange(date, recentPaidRange(asOf)) : false;
}

/** Recently paid amount total — 30-day payments plus QuickBooks window carryover. */
export function computeRecentlyPaidAmountTotal(
  transactions: readonly MockSalesTransaction[],
  asOf = dashboardLedgerAnchor(),
): number {
  let total = 0;
  for (const txn of transactions) {
    if (!isRecentlyPaidSalesPaymentForAmount(txn, asOf)) continue;
    total += Math.abs(txn.amount);
  }

  const end = startOfDay(asOf);
  const windowStart = addDays(end, -SALES_RECENTLY_PAID_LOOKBACK_DAYS);

  // QuickBooks keeps up to ₱1,000 from the most recent payment day that rolled
  // off the 30-day window (not only the single calendar day before the window).
  let nearestPriorDay: number | null = null;
  let carryover = 0;
  for (const txn of transactions) {
    if (txn.type !== "Payment" || isVoidSalesTransaction(txn)) continue;
    if (!isRecentlyPaidPaymentStatus(qbStatus(txn))) continue;
    const date = parseTransactionDate(txn.date);
    if (!date) continue;
    const day = startOfDay(date).getTime();
    if (day >= windowStart.getTime()) continue;
    if (nearestPriorDay == null || day > nearestPriorDay) {
      nearestPriorDay = day;
      carryover = Math.abs(txn.amount);
    } else if (day === nearestPriorDay) {
      carryover += Math.abs(txn.amount);
    }
  }

  if (carryover > 0) {
    total += Math.min(carryover, 1000);
  }

  return total;
}

/** Recently paid amount — all payment rows in the last 30 days (inclusive). */
export function isRecentlyPaidSalesPayment(
  txn: MockSalesTransaction,
  asOf = dashboardLedgerAnchor(),
): boolean {
  if (txn.type !== "Payment" || isVoidSalesTransaction(txn)) return false;
  const status = qbStatus(txn);
  if (status === "void") return false;

  const date = parseTransactionDate(txn.date);
  return date ? isDateInRange(date, recentPaidRange(asOf)) : false;
}

/** Recently paid count — applied/closed payments in the last 29 days (QuickBooks). */
export function isRecentlyPaidSalesPaymentForCount(
  txn: MockSalesTransaction,
  asOf = dashboardLedgerAnchor(),
): boolean {
  if (txn.type !== "Payment" || isVoidSalesTransaction(txn)) return false;
  const status = qbStatus(txn);
  // QuickBooks sales "recently paid" count excludes unapplied payments.
  if (status !== "applied" && status !== "closed") return false;

  const date = parseTransactionDate(txn.date);
  if (!date) return false;

  const end = startOfDay(asOf);
  const start = addDays(end, -29);
  const day = startOfDay(date).getTime();
  return day > start.getTime() && day <= end.getTime();
}

/** @deprecated Use isRecentlyPaidSalesPayment — kept for type filter compatibility. */
export function isRecentlyPaidSalesInvoice(
  txn: MockSalesTransaction,
  asOf = dashboardLedgerAnchor(),
): boolean {
  return isRecentlyPaidSalesPayment(txn, asOf);
}

export function salesTransactionDateRange(
  filter: SalesTransactionDateFilter | string,
  asOf = dashboardLedgerAnchor(),
  customFrom?: Date,
  customTo?: Date,
): ReportDateRange | null {
  return salesTransactionListDateRange(filter, { asOf, customFrom, customTo });
}

export function transactionInDateRange(
  txn: MockSalesTransaction,
  range: ReportDateRange | null,
): boolean {
  if (!range) return true;
  const date = parseTransactionDate(txn.date);
  return date ? isDateInRange(date, range) : false;
}

function activeTransactions(transactions: readonly MockSalesTransaction[]): MockSalesTransaction[] {
  return transactions.filter((t) => !isVoidSalesTransaction(t));
}

function openRowAmount(
  txn: MockSalesTransaction,
  openBalances: ReadonlyMap<string, number>,
): number {
  if (txn.type === "Invoice") return invoiceOpenAmount(txn, openBalances);
  if (txn.type === "Credit Note") return Math.abs(txn.amount);
  return 0;
}

export type SalesTransactionKpiOptions = {
  /** Type, date, and customer scope for estimates / unbilled. */
  listScope?: readonly MockSalesTransaction[];
  /** Type and customer scope for overdue / open AR buckets. */
  arScope?: readonly MockSalesTransaction[];
  customerQuery?: string;
  /**
   * When present AND exported as of today, use AR ageing detail open balances.
   * Stale AR snapshots must not override the sales list (QuickBooks sales KPI).
   */
  arAgingDetailLines?: readonly ImportedArAgingDetailLine[];
  /** AR ageing snapshot "as of" label — required for AR overlay to apply. */
  arAgingAsOf?: string;
};

function buildArAgingOpenBalanceByInvoiceRef(
  lines: readonly ImportedArAgingDetailLine[],
): Map<string, { openBalance: number; bucket: ImportedArAgingDetailLine["bucket"] }> {
  const map = new Map<string, { openBalance: number; bucket: ImportedArAgingDetailLine["bucket"] }>();
  for (const line of lines) {
    const type = line.transactionType.trim().toLowerCase();
    if (type !== "invoice") continue;
    const key = normalizeInvoiceRef(line.referenceNumber);
    if (!key) continue;
    map.set(key, { openBalance: Math.max(0, Number(line.openBalance) || 0), bucket: line.bucket });
  }
  return map;
}

/**
 * KPI strip for Sales Transactions.
 *
 * - Estimates / unbilled use `listScope` (Type, Date, Customer — same as the table).
 * - Overdue / open use payment-adjusted open balances from the last 365 days
 *   (Type and Customer only — QuickBooks ignores the list date filter).
 * - Recently paid uses all Payment rows from the last 30 days.
 */
export function computeSalesTransactionKpiSummary(
  allTransactions: readonly MockSalesTransaction[],
  asOf = dashboardLedgerAnchor(),
  options: SalesTransactionKpiOptions = {},
): SalesTransactionKpiSummary {
  const listScope = activeTransactions(options.listScope ?? allTransactions);
  const arScope = activeTransactions(options.arScope ?? listScope);
  const activeAll = activeTransactions(allTransactions);
  const openBalances = salesTransactionOpenBalances(activeAll);
  const useArAging =
    Boolean(options.arAgingDetailLines?.length) &&
    isArAgingSnapshotAsOfToday(options.arAgingAsOf, asOf);
  const arAgingInvoiceOpen =
    useArAging && options.arAgingDetailLines
      ? buildArAgingOpenBalanceByInvoiceRef(options.arAgingDetailLines)
      : null;
  const customerQuery = options.customerQuery;

  const estimates = listScope.filter((txn) => isActiveEstimate(txn, asOf));
  const unbilled = listScope.filter(isUnbilledSalesReceipt);

  const arInvoices = arScope.filter((txn) => txn.type === "Invoice");

  const arInvoiceOpenAmount = (txn: MockSalesTransaction) => {
    if (txn.type !== "Invoice") return 0;
    if (arAgingInvoiceOpen) {
      const key = normalizeInvoiceRef(txn.number);
      const match = key ? arAgingInvoiceOpen.get(key) : undefined;
      if (match) return match.openBalance;
    }
    return invoiceOpenAmount(txn, openBalances);
  };

  const overdue = arInvoices.filter((txn) => {
    if (txn.type !== "Invoice" || isVoidSalesTransaction(txn)) return false;
    if (!isInvoiceDateInLookback(txn.date, INVOICE_UNPAID_LOOKBACK_DAYS, asOf)) return false;
    if (arAgingInvoiceOpen) {
      const key = normalizeInvoiceRef(txn.number);
      const match = key ? arAgingInvoiceOpen.get(key) : undefined;
      if (!match) return isSalesArOverdueInvoice(txn, openBalances, asOf);
      return match.bucket !== "current" && match.openBalance > 0;
    }
    return isSalesArOverdueInvoice(txn, openBalances, asOf);
  });

  const openInvoices = arInvoices.filter((txn) => {
    if (txn.type !== "Invoice" || isVoidSalesTransaction(txn)) return false;
    if (!isInvoiceDateInLookback(txn.date, INVOICE_UNPAID_LOOKBACK_DAYS, asOf)) return false;
    return arInvoiceOpenAmount(txn) > 0;
  });

  const openCredits = arScope.filter((txn) => isSalesArOpenCreditNote(txn, asOf));
  const open = [...openInvoices, ...openCredits];

  const recentlyPaidScope = customerQuery
    ? activeAll.filter((txn) => matchesCustomerQuery(txn, customerQuery))
    : activeAll;
  const recentlyPaidCount = recentlyPaidScope.filter((txn) =>
    isRecentlyPaidSalesPaymentForCount(txn, asOf),
  );

  const sumAmounts = (rows: MockSalesTransaction[]) =>
    rows.reduce((total, row) => total + Math.abs(row.amount), 0);

  const sumOverdueAmounts = (rows: MockSalesTransaction[]) =>
    rows.reduce(
      (total, row) => total + kpiOverdueInvoiceAmount(row, openBalances, arAgingInvoiceOpen, asOf),
      0,
    );

  const sumOpenAmounts = (rows: MockSalesTransaction[]) =>
    rows.reduce((total, row) => {
      if (row.type === "Invoice") {
        return total + kpiOpenInvoiceAmount(row, openBalances, arAgingInvoiceOpen);
      }
      return total + openRowAmount(row, openBalances);
    }, 0);

  const segments: SalesTransactionKpiSegment[] = [
    {
      id: "estimates",
      amount: sumAmounts(estimates),
      count: estimates.length,
      label: "estimates",
      barClass: "bg-sky-400",
      textClass: "text-sky-700",
      showCount: true,
    },
    {
      id: "unbilled",
      amount: sumAmounts(unbilled),
      count: unbilled.length,
      label: "Unbilled income",
      barClass: "bg-violet-500",
      textClass: "text-violet-700",
      showCount: false,
    },
    {
      id: "overdue",
      amount: sumOverdueAmounts(overdue),
      count: overdue.length,
      label: "overdue invoices",
      barClass: "bg-amber-500",
      textClass: "text-amber-700",
      showCount: true,
    },
    {
      id: "open",
      amount: sumOpenAmounts(open),
      count: open.length,
      label: "open invoices and credits",
      barClass: "bg-muted-foreground/50",
      textClass: "text-foreground",
      showCount: true,
    },
    {
      id: "paid",
      amount: computeRecentlyPaidAmountTotal(recentlyPaidScope, asOf),
      count: recentlyPaidCount.length,
      label: "recently paid",
      barClass: "bg-emerald-500",
      textClass: "text-emerald-700",
      showCount: true,
    },
  ];

  return { segments };
}

export function salesTransactionMatchesKpiFilter(
  txn: MockSalesTransaction,
  filter: SalesTransactionKpiId,
  allTransactions: readonly MockSalesTransaction[] = [],
  arAgingDetailLines: readonly ImportedArAgingDetailLine[] = [],
  asOf = dashboardLedgerAnchor(),
  arAgingAsOf?: string,
): boolean {
  if (isVoidSalesTransaction(txn)) return false;

  const openBalances = salesTransactionOpenBalances(activeTransactions(allTransactions));
  const useArAging =
    arAgingDetailLines.length > 0 && isArAgingSnapshotAsOfToday(arAgingAsOf, asOf);
  const arAgingInvoiceOpen = useArAging
    ? buildArAgingOpenBalanceByInvoiceRef(arAgingDetailLines)
    : null;
  const arInvoiceOpenAmount = (t: MockSalesTransaction) => {
    if (t.type !== "Invoice") return 0;
    if (arAgingInvoiceOpen) {
      const key = normalizeInvoiceRef(t.number);
      const match = key ? arAgingInvoiceOpen.get(key) : undefined;
      if (match) return match.openBalance;
    }
    return invoiceOpenAmount(t, openBalances);
  };

  switch (filter) {
    case "estimates":
      return isActiveEstimate(txn, asOf);
    case "unbilled":
      return isUnbilledSalesReceipt(txn);
    case "overdue":
      if (txn.type !== "Invoice") return false;
      if (!isInvoiceDateInLookback(txn.date, INVOICE_UNPAID_LOOKBACK_DAYS, asOf)) return false;
      if (arAgingInvoiceOpen) {
        const key = normalizeInvoiceRef(txn.number);
        const match = key ? arAgingInvoiceOpen.get(key) : undefined;
        if (match) return match.bucket !== "current" && match.openBalance > 0;
      }
      return isSalesArOverdueInvoice(txn, openBalances, asOf);
    case "open":
      return (
        (txn.type === "Invoice" &&
          isInvoiceDateInLookback(txn.date, INVOICE_UNPAID_LOOKBACK_DAYS, asOf) &&
          arInvoiceOpenAmount(txn) > 0) ||
        isSalesArOpenCreditNote(txn, asOf)
      );
    case "paid":
      return isRecentlyPaidSalesPayment(txn, asOf);
    default:
      return true;
  }
}
