import type { MockChartAccount } from "@/lib/mock-data/chart-of-accounts";
import type { MockExpenseTransaction } from "@/lib/mock-data/expenses";
import type { MockProductService } from "@/lib/mock-data/products-services";
import type { MockRecurringTemplate } from "@/lib/mock-data/recurring-transactions";
import type { MockSalesTransaction } from "@/lib/mock-data/sales";
import type { MockSupplier } from "@/lib/mock-data/suppliers";
import type { MockCustomer, MockInvoice, MockInvoiceLine, MockLead } from "@/lib/mock-data/types";
import type { UnpaidBill } from "@/lib/mock-data/unpaid-bills";

export const BACKUP_FORMAT_VERSION = 1 as const;

export type BackupSnapshot = {
  format: "petrosphere-backup";
  version: typeof BACKUP_FORMAT_VERSION;
  createdAt: string;
  app: string;
  counts: Record<string, number>;
  data: {
    chartOfAccounts: MockChartAccount[];
    customers: MockCustomer[];
    leads: MockLead[];
    suppliers: MockSupplier[];
    productServices: MockProductService[];
    salesTransactions: MockSalesTransaction[];
    /** Invoice/sales lines keyed by reference number. */
    salesTransactionLines: Record<string, MockInvoiceLine[]>;
    /** Location keyed by reference number. */
    salesTransactionLocations: Record<string, string>;
    expenseTransactions: MockExpenseTransaction[];
    unpaidBills: UnpaidBill[];
    invoices: MockInvoice[];
    recurringTemplates: MockRecurringTemplate[];
  };
};

export type BackupRestoreResult = {
  ok: boolean;
  restored: Record<string, number>;
  errors: string[];
};

export function isBackupSnapshot(value: unknown): value is BackupSnapshot {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return (
    obj.format === "petrosphere-backup" &&
    typeof obj.version === "number" &&
    obj.data != null &&
    typeof obj.data === "object"
  );
}
