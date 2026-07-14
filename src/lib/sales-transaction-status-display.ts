import { parseTransactionDate } from "@/lib/ledger/date-utils";
import { dashboardLedgerAnchor } from "@/lib/ledger/dashboard-ledger-anchor";
import { invoiceOpenBalance } from "@/lib/ledger/invoice-open-balance";
import type { MockSalesTransaction } from "@/lib/mock-data/sales";

export type SalesTransactionStatusTone = "success" | "muted" | "warning" | "default";

export type SalesTransactionStatusDisplay = {
  label: string;
  tone: SalesTransactionStatusTone;
  detail?: string;
};

type StatusInput = Pick<
  MockSalesTransaction,
  "id" | "date" | "type" | "amount" | "status" | "qbStatus" | "memo"
>;

export type SalesTransactionStatusOptions = {
  openBalances?: ReadonlyMap<string, number>;
  asOf?: Date;
};

function qbStatus(txn: StatusInput): string {
  return txn.qbStatus?.trim().toLowerCase() ?? "";
}

function isVoidTransaction(txn: StatusInput): boolean {
  const status = qbStatus(txn);
  const memo = txn.memo.trim().toLowerCase();
  return status === "void" || memo.includes("void");
}

function formatDue(amount: number): string {
  return `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parseOverdueDays(detail: string | undefined): number | undefined {
  const match = detail?.match(/(\d+)\s*day/i);
  return match ? Number(match[1]) : undefined;
}

function estimateOverdueDays(txn: StatusInput, asOf: Date): number {
  const fromDetail =
    txn.status.kind === "overdue" ? parseOverdueDays(txn.status.detail) : undefined;
  if (fromDetail != null) return fromDetail;

  const invoiceDate = parseTransactionDate(txn.date);
  if (!invoiceDate) return 1;
  const dueDate = new Date(invoiceDate);
  dueDate.setDate(dueDate.getDate() + 14);
  const diffMs = asOf.getTime() - dueDate.getTime();
  return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

function invoiceStatusFromOpenBalance(
  txn: StatusInput,
  openBalances: ReadonlyMap<string, number>,
  asOf: Date,
): SalesTransactionStatusDisplay | null {
  if (txn.type !== "Invoice") return null;

  const amount = Math.abs(txn.amount);
  const balance = invoiceOpenBalance(
    {
      id: txn.id,
      date: txn.date,
      customer: "",
      amount: txn.amount,
      qbStatus: qbStatus(txn),
    },
    openBalances,
  );
  const raw = qbStatus(txn);

  if (balance <= 0 || raw === "paid") {
    return { label: "Paid", tone: "success" };
  }

  const isPartial = balance > 0 && balance < amount;
  const partialDetail = isPartial ? `Partially paid, ${formatDue(balance)} due` : undefined;
  const isOverdue =
    raw === "overdue" ||
    raw === "expired" ||
    txn.status.kind === "overdue" ||
    (isPartial && raw !== "open" && raw !== "partial");

  if (isOverdue) {
    const days = estimateOverdueDays(txn, asOf);
    return {
      label: raw === "expired" ? "Expired" : `Overdue ${days} day${days === 1 ? "" : "s"}`,
      tone: "warning",
      detail: partialDetail,
    };
  }

  if (isPartial || raw === "partial") {
    return {
      label: "Partially paid",
      tone: "warning",
      detail: `${formatDue(balance)} due`,
    };
  }

  if (raw === "open") {
    return { label: "Open", tone: "default" };
  }

  return { label: "Open", tone: "default" };
}

/** QuickBooks-style status label for the sales transactions list. */
export function getSalesTransactionStatusDisplay(
  txn: StatusInput,
  options: SalesTransactionStatusOptions = {},
): SalesTransactionStatusDisplay {
  const raw = qbStatus(txn);
  const asOf = options.asOf ?? dashboardLedgerAnchor();

  if (isVoidTransaction(txn)) {
    return { label: "Voided", tone: "muted" };
  }

  if (raw === "unapplied" || txn.status.kind === "unapplied") {
    return { label: "Unapplied", tone: "muted" };
  }

  if (txn.type === "Estimate") {
    if (raw === "open" || raw === "pending" || raw === "") {
      return { label: "Pending", tone: "default" };
    }
    if (raw === "accepted") {
      return { label: "Accepted", tone: "success" };
    }
    if (raw === "expired") {
      return { label: "Expired", tone: "muted" };
    }
    if (raw === "applied") {
      return { label: "Applied", tone: "success" };
    }
  }

  if (options.openBalances) {
    const fromBalance = invoiceStatusFromOpenBalance(txn, options.openBalances, asOf);
    if (fromBalance) return fromBalance;
  }

  if (txn.type === "Payment" && (raw === "applied" || raw === "closed")) {
    return { label: "Closed", tone: "success" };
  }

  if (raw === "paid") {
    return { label: "Paid", tone: "success" };
  }

  if (raw === "applied") {
    return { label: "Applied", tone: "success" };
  }

  if (raw === "closed" || txn.status.kind === "closed") {
    return { label: "Closed", tone: "success" };
  }

  if (raw === "open") {
    return { label: "Open", tone: "default" };
  }

  if (raw === "partial") {
    return {
      label: "Partially paid",
      tone: "warning",
      detail: txn.status.kind === "overdue" ? txn.status.detail : undefined,
    };
  }

  if (raw === "overdue" || raw === "expired" || txn.status.kind === "overdue") {
    const days = estimateOverdueDays(txn, asOf);
    return {
      label: raw === "expired" ? "Expired" : `Overdue ${days} day${days === 1 ? "" : "s"}`,
      tone: "warning",
      detail: txn.status.kind === "overdue" ? txn.status.detail : undefined,
    };
  }

  return { label: "Open", tone: "default" };
}
