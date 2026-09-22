import { listChartAccountsFromDb } from "@/lib/chart-of-accounts/repository";
import { listCustomersFromDb } from "@/lib/customers/repository";
import { listExpenseTransactionsFromDb } from "@/lib/expense-transactions/repository";
import { listInvoicesFromDb } from "@/lib/invoices/repository";
import { listLeadsFromDb } from "@/lib/leads/repository";
import { listProductServicesFromDb } from "@/lib/product-services/repository";
import { listRecurringTemplatesFromDb } from "@/lib/recurring-templates/repository";
import { listSalesTransactionLinesFromDb } from "@/lib/sales-transactions/lines-repository";
import { listSalesTransactionLocationsFromDb } from "@/lib/sales-transactions/locations-repository";
import { listSalesTransactionsFromDb } from "@/lib/sales-transactions/repository";
import { listSuppliersFromDb } from "@/lib/suppliers/repository";
import { listUnpaidBillsFromDb } from "@/lib/unpaid-bills/repository";
import {
  BACKUP_FORMAT_VERSION,
  type BackupSnapshot,
} from "./types";

export async function buildBackupSnapshot(): Promise<BackupSnapshot> {
  const [
    chartOfAccounts,
    customers,
    leads,
    suppliers,
    productServices,
    salesTransactions,
    salesTransactionLines,
    salesTransactionLocationsMap,
    expenseTransactions,
    unpaidBills,
    invoices,
    recurringTemplates,
  ] = await Promise.all([
    listChartAccountsFromDb(),
    listCustomersFromDb(),
    listLeadsFromDb(),
    listSuppliersFromDb(),
    listProductServicesFromDb(),
    listSalesTransactionsFromDb(),
    listSalesTransactionLinesFromDb(),
    listSalesTransactionLocationsFromDb(),
    listExpenseTransactionsFromDb(),
    listUnpaidBillsFromDb(),
    listInvoicesFromDb(),
    listRecurringTemplatesFromDb(),
  ]);

  const salesTransactionLocations = Object.fromEntries(salesTransactionLocationsMap.entries());
  const lineCount = Object.values(salesTransactionLines).reduce(
    (sum, lines) => sum + lines.length,
    0,
  );

  const data: BackupSnapshot["data"] = {
    chartOfAccounts,
    customers,
    leads,
    suppliers,
    productServices,
    salesTransactions,
    salesTransactionLines,
    salesTransactionLocations,
    expenseTransactions,
    unpaidBills,
    invoices,
    recurringTemplates,
  };

  return {
    format: "petrosphere-backup",
    version: BACKUP_FORMAT_VERSION,
    createdAt: new Date().toISOString(),
    app: "Petrosphere Inc. Accounting System",
    counts: {
      chartOfAccounts: chartOfAccounts.length,
      customers: customers.length,
      leads: leads.length,
      suppliers: suppliers.length,
      productServices: productServices.length,
      salesTransactions: salesTransactions.length,
      salesTransactionLines: lineCount,
      salesTransactionLocations: Object.keys(salesTransactionLocations).length,
      expenseTransactions: expenseTransactions.length,
      unpaidBills: unpaidBills.length,
      invoices: invoices.length,
      recurringTemplates: recurringTemplates.length,
    },
    data,
  };
}
