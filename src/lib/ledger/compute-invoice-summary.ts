import { formatTransactionDateDisplay, parseTransactionDate } from "@/lib/ledger/date-utils";
import { dashboardLedgerAnchor } from "@/lib/ledger/dashboard-ledger-anchor";
import {
  computeInvoiceOpenBalances,
  invoiceOpenBalance,
  isInvoiceDateInLookback,
  type InvoiceOpenBalanceRow,
  type PaymentAllocationRow,
} from "@/lib/ledger/invoice-open-balance";
import {
  isRecentlyPaidSalesPaymentForAmount,
  isRecentlyPaidSalesPaymentForCount,
} from "@/lib/ledger/compute-sales-transaction-kpi";
import { salesTransactionOpenBalances } from "@/lib/ledger/invoices-from-sales-transactions";
import {
  CUSTOMER_HUB_UNPAID_LOOKBACK_DAYS,
  INVOICE_UNPAID_LOOKBACK_DAYS,
} from "@/lib/mock-data/compute";
import type { MockSalesTransaction } from "@/lib/mock-data/sales";
import type { CustomerHubOverdue, ReceivablesSummary } from "@/lib/mock-data/types";

function qbStatus(txn: MockSalesTransaction): string {
  return txn.qbStatus?.trim().toLowerCase() ?? "";
}

function isVoidSalesTransaction(txn: MockSalesTransaction): boolean {
  const status = qbStatus(txn);
  const memo = txn.memo.trim().toLowerCase();
  return status === "void" || memo.includes("void");
}

function isUnpaidInvoiceStatus(status: string): boolean {
  return !["paid", "closed", "void"].includes(status);
}

function isOverdueInvoiceStatus(status: string): boolean {
  return status === "overdue";
}

function isNotDueYetInvoiceStatus(status: string): boolean {
  return status === "open" || status === "partial";
}

function toInvoiceRow(txn: MockSalesTransaction): InvoiceOpenBalanceRow {
  return {
    id: txn.id,
    date: txn.date,
    customer: txn.customer,
    amount: txn.amount,
    qbStatus: qbStatus(txn),
  };
}

function toPaymentRow(txn: MockSalesTransaction): PaymentAllocationRow {
  return {
    date: txn.date,
    customer: txn.customer,
    amount: txn.amount,
    qbStatus: qbStatus(txn),
    memo: txn.memo,
  };
}

function invoiceCountsAsOverdue(status: string): boolean {
  if (isOverdueInvoiceStatus(status)) return true;
  if (isNotDueYetInvoiceStatus(status)) return false;
  return true;
}

/**
 * Invoices page summary bar — matches QuickBooks import behavior:
 * - Unpaid (last 365 days): open balance on unpaid invoices by invoice date
 * - Overdue vs not due: overdue status vs open/partial
 * - Paid (last 30 days): all Payment rows (incl. unapplied), QuickBooks count rules
 */
export function computeInvoiceSummaryFromSalesTransactions(
  transactions: readonly MockSalesTransaction[],
  asOf = dashboardLedgerAnchor(),
  unpaidLookbackDays = INVOICE_UNPAID_LOOKBACK_DAYS,
): ReceivablesSummary {
  const active = transactions.filter((txn) => !isVoidSalesTransaction(txn));

  const invoiceRows = active.filter((txn) => txn.type === "Invoice").map(toInvoiceRow);
  const paymentRows = active.filter((txn) => txn.type === "Payment").map(toPaymentRow);
  const openBalances = computeInvoiceOpenBalances(invoiceRows, paymentRows);

  let unpaidTotal = 0;
  let overdueAmount = 0;
  let notDueYet = 0;
  let overdueCount = 0;
  let unpaidCount = 0;

  for (const txn of active) {
    if (txn.type !== "Invoice") continue;
    const status = qbStatus(txn);
    if (!isUnpaidInvoiceStatus(status)) continue;
    if (!isInvoiceDateInLookback(txn.date, unpaidLookbackDays, asOf)) continue;

    const open = invoiceOpenBalance(toInvoiceRow(txn), openBalances);
    if (open <= 0) continue;

    unpaidTotal += open;
    unpaidCount += 1;

    if (isOverdueInvoiceStatus(status)) {
      overdueAmount += open;
      overdueCount += 1;
    } else if (isNotDueYetInvoiceStatus(status)) {
      notDueYet += open;
    } else {
      overdueAmount += open;
      overdueCount += 1;
    }
  }

  let paidTotal = 0;
  let paidCount = 0;

  for (const txn of active) {
    // Invoices money bar: applied/closed payments only (no unapplied, no carryover).
    if (txn.type !== "Payment" || isVoidSalesTransaction(txn)) continue;
    const status = qbStatus(txn);
    if (status !== "applied" && status !== "closed") continue;
    if (!isRecentlyPaidSalesPaymentForAmount(txn, asOf)) continue;
    paidTotal += Math.abs(txn.amount);
  }

  for (const txn of active) {
    if (!isRecentlyPaidSalesPaymentForCount(txn, asOf)) continue;
    paidCount += 1;
  }

  return {
    unpaidTotal,
    overdueAmount,
    notDueYet,
    overdueCount,
    unpaidCount,
    paidTotal,
    paidCount,
    notDeposited: 0,
    deposited: paidTotal,
    estimatesAmount: 0,
    estimatesCount: 0,
    unbilledIncome: 0,
  };
}

export type ComputeCustomerHubOverdueOptions = {
  asOf?: Date;
  lookbackDays?: number;
  rowLimit?: number;
};

/**
 * Customer Hub overdue card — matches QuickBooks Customer Hub "as of today":
 * overdue open AR on sales invoices in the hub lookback window only.
 *
 * Do not use A/R Ageing Detail totals here — that report includes all historical
 * past-due rows (~₱1M+) and is not what the Customer Hub card displays.
 */
export function computeCustomerHubOverdue(
  transactions: readonly MockSalesTransaction[],
  options: ComputeCustomerHubOverdueOptions = {},
): CustomerHubOverdue {
  const asOf = options.asOf ?? dashboardLedgerAnchor();
  const lookbackDays = options.lookbackDays ?? CUSTOMER_HUB_UNPAID_LOOKBACK_DAYS;
  const rowLimit = options.rowLimit ?? 4;

  const summary = computeInvoiceSummaryFromSalesTransactions(
    transactions,
    asOf,
    lookbackDays,
  );

  const active = transactions.filter((txn) => !isVoidSalesTransaction(txn));
  const openBalances = salesTransactionOpenBalances(active);
  const overdueItems: { txn: MockSalesTransaction; open: number }[] = [];

  for (const txn of active) {
    if (txn.type !== "Invoice") continue;
    const status = qbStatus(txn);
    if (!isUnpaidInvoiceStatus(status)) continue;
    if (!isInvoiceDateInLookback(txn.date, lookbackDays, asOf)) continue;
    if (!invoiceCountsAsOverdue(status)) continue;

    const open = invoiceOpenBalance(toInvoiceRow(txn), openBalances);
    if (open <= 0) continue;
    overdueItems.push({ txn, open });
  }

  overdueItems.sort((a, b) => {
    const byDate =
      (parseTransactionDate(b.txn.date)?.getTime() ?? 0) -
      (parseTransactionDate(a.txn.date)?.getTime() ?? 0);
    return byDate !== 0 ? byDate : a.txn.id.localeCompare(b.txn.id);
  });

  return {
    amount: summary.overdueAmount,
    count: summary.overdueCount,
    rows: overdueItems.slice(0, rowLimit).map(({ txn, open }) => ({
      invoiceId: txn.id,
      client: txn.customer,
      date: formatTransactionDateDisplay(txn.date),
      amount: open,
    })),
  };
}
