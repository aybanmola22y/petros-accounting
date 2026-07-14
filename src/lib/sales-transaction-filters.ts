import type { MockSalesTransaction } from "@/lib/mock-data/sales";
import { dashboardLedgerAnchor } from "@/lib/ledger/dashboard-ledger-anchor";
import { isActiveEstimate, isRecentlyPaidSalesPayment } from "@/lib/ledger/compute-sales-transaction-kpi";

export const SALES_TYPE_FILTER_OPTIONS = [
  "All transactions",
  "Invoices",
  "Estimates",
  "Change orders",
  "Credit notes",
  "Sales Receipts",
  "Unbilled Income",
  "Money received",
  "Recently paid",
] as const;

export const SALES_STATUS_FILTER_OPTIONS = [
  "All",
  "Open",
  "Overdue",
  "Paid",
  "Pending",
  "Accepted",
  "Closed",
] as const;

export const SALES_DELIVERY_FILTER_OPTIONS = ["Any", "Send later", "Print later"] as const;

export const SALES_ERROR_FILTER_OPTIONS = ["None", "Delivery errors"] as const;

export type SalesTypeFilter = (typeof SALES_TYPE_FILTER_OPTIONS)[number];
export type SalesStatusFilter = (typeof SALES_STATUS_FILTER_OPTIONS)[number];
export type SalesDeliveryFilter = (typeof SALES_DELIVERY_FILTER_OPTIONS)[number];
export type SalesErrorFilter = (typeof SALES_ERROR_FILTER_OPTIONS)[number];

function qbStatus(txn: MockSalesTransaction): string {
  return txn.qbStatus?.trim().toLowerCase() ?? "";
}

function isVoidTransaction(txn: MockSalesTransaction): boolean {
  const status = qbStatus(txn);
  const memo = txn.memo.trim().toLowerCase();
  return status === "void" || memo.includes("void");
}

/** QuickBooks sales list footer — payments/credits/refunds reduce the total. */
export function salesTransactionListSignedAmount(txn: MockSalesTransaction): number {
  if (isVoidTransaction(txn)) return 0;
  const amount = Math.abs(txn.amount);
  if (txn.type === "Payment" || txn.type === "Credit Note" || txn.type === "Refund") {
    return -amount;
  }
  return amount;
}

export function salesStatusFilterLabel(filter: SalesStatusFilter): string {
  return filter === "All" ? "All statuses" : filter;
}

export function salesDeliveryFilterLabel(filter: SalesDeliveryFilter): string {
  return filter === "Any" ? "Delivery method" : filter;
}

export function salesErrorFilterLabel(filter: SalesErrorFilter): string {
  return filter === "None" ? "Errors" : filter;
}

/** QuickBooks-style type filter on the sales transactions list. */
export function salesTransactionMatchesTypeFilter(
  txn: MockSalesTransaction,
  filter: SalesTypeFilter,
  asOf = dashboardLedgerAnchor(),
): boolean {
  if (filter === "All transactions") return true;

  switch (filter) {
    case "Invoices":
      return txn.type === "Invoice";
    case "Estimates":
      return isActiveEstimate(txn);
    case "Change orders":
      return txn.type === "Change order";
    case "Credit notes":
      return txn.type === "Credit Note";
    case "Sales Receipts":
      return txn.type === "Sales receipt";
    case "Unbilled Income": {
      const status = qbStatus(txn);
      return (
        txn.type === "Sales receipt" &&
        (status === "open" || status === "partial" || status === "unbilled")
      );
    }
    case "Money received":
      return txn.type === "Payment";
    case "Recently paid":
      return isRecentlyPaidSalesPayment(txn, asOf);
    default:
      return true;
  }
}

/** QuickBooks-style status filter on the sales transactions list. */
export function salesTransactionMatchesStatusFilter(
  txn: MockSalesTransaction,
  filter: SalesStatusFilter,
): boolean {
  if (filter === "All") return true;

  const status = qbStatus(txn);
  const voided = isVoidTransaction(txn);

  switch (filter) {
    case "Open":
      return !voided && (status === "open" || status === "partial" || status === "unbilled");
    case "Overdue":
      return !voided && (status === "overdue" || status === "expired");
    case "Paid":
      return !voided && status === "paid";
    case "Pending":
      return (
        txn.type === "Estimate" &&
        !voided &&
        (status === "pending" || status === "open" || status === "")
      );
    case "Accepted":
      return txn.type === "Estimate" && !voided && status === "accepted";
    case "Closed":
      return (
        voided ||
        status === "applied" ||
        status === "closed" ||
        (txn.status.kind === "closed" && status !== "paid" && status !== "unapplied")
      );
    default:
      return true;
  }
}

export function salesTransactionMatchesDeliveryFilter(
  txn: MockSalesTransaction,
  filter: SalesDeliveryFilter,
): boolean {
  if (filter === "Any") return true;
  if (filter === "Send later") return txn.deliveryMethod === "send_later";
  if (filter === "Print later") return txn.deliveryMethod === "print_later";
  return true;
}

export function salesTransactionMatchesErrorFilter(
  txn: MockSalesTransaction,
  filter: SalesErrorFilter,
): boolean {
  if (filter === "None") return true;
  if (filter === "Delivery errors") return Boolean(txn.deliveryError);
  return true;
}
