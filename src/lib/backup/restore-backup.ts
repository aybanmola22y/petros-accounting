import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { mockChartAccountToInsert } from "@/lib/chart-of-accounts/types";
import { normalizeCustomerCurrency } from "@/lib/customers/types";
import { parsedExpenseToInsert } from "@/lib/expense-transactions/types";
import { mockInvoiceToInsert } from "@/lib/invoices/types";
import { parsedProductServiceToInsert } from "@/lib/product-services/types";
import { mockRecurringTemplateToInsert } from "@/lib/recurring-templates/types";
import {
  replaceSalesTransactionLinesInDb,
  type SalesTransactionLineInsert,
} from "@/lib/sales-transactions/lines-repository";
import { upsertSalesTransactionLocationsInDb } from "@/lib/sales-transactions/locations-repository";
import { parseTransactionDate } from "@/lib/ledger/date-utils";
import { toIsoDate } from "@/lib/report-date-utils";
import { normalizeSupplierCurrency } from "@/lib/suppliers/types";
import { parsedUnpaidBillToInsert } from "@/lib/unpaid-bills/types";
import type { MockSalesTransaction } from "@/lib/mock-data/sales";
import type { BackupRestoreResult, BackupSnapshot } from "./types";
import { isBackupSnapshot } from "./types";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";
const BATCH = 500;

async function clearTable(table: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from(table).delete().neq("id", NIL_UUID);
  if (error) throw new Error(`${table}: ${error.message}`);
}

async function insertBatches(
  table: string,
  rows: Record<string, unknown>[],
): Promise<number> {
  if (rows.length === 0) return 0;
  const supabase = createSupabaseAdminClient();
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase.from(table).insert(batch);
    if (error) throw new Error(`${table}: ${error.message}`);
    inserted += batch.length;
  }
  return inserted;
}

function mockSalesStatusToDb(txn: Pick<MockSalesTransaction, "status" | "qbStatus">): string {
  if (txn.qbStatus?.trim()) return txn.qbStatus.trim();
  if (txn.status.kind === "closed") return "closed";
  if (txn.status.kind === "unapplied") return "unapplied";
  if (txn.status.kind === "overdue") return "overdue";
  return "open";
}

export async function restoreBackupSnapshot(
  snapshot: BackupSnapshot,
): Promise<BackupRestoreResult> {
  if (!isBackupSnapshot(snapshot)) {
    return { ok: false, restored: {}, errors: ["Invalid backup file format."] };
  }
  if (snapshot.version > 1) {
    return {
      ok: false,
      restored: {},
      errors: [`Unsupported backup version ${snapshot.version}.`],
    };
  }

  const data = snapshot.data;
  const restored: Record<string, number> = {};
  const errors: string[] = [];

  // Delete in reverse dependency order.
  const clearOrder = [
    "invoices",
    "unpaid_bills",
    "sales_transaction_lines",
    "sales_transaction_locations",
    "sales_transactions",
    "expense_transactions",
    "recurring_templates",
    "product_services",
    "leads",
    "customers",
    "suppliers",
    "chart_of_accounts",
  ];

  try {
    for (const table of clearOrder) {
      try {
        if (table === "sales_transaction_lines") {
          const supabase = createSupabaseAdminClient();
          const { error } = await supabase
            .from(table)
            .delete()
            .neq("reference_number", "");
          if (error && error.code !== "PGRST205") throw new Error(error.message);
          continue;
        }
        if (table === "sales_transaction_locations") {
          const supabase = createSupabaseAdminClient();
          const { error } = await supabase
            .from(table)
            .delete()
            .neq("reference_number", "");
          if (error && error.code !== "PGRST205") throw new Error(error.message);
          continue;
        }
        await clearTable(table);
      } catch (error) {
        // Missing optional tables shouldn't abort the whole restore.
        const message = error instanceof Error ? error.message : String(error);
        if (/does not exist|schema cache|PGRST205/i.test(message)) continue;
        throw error;
      }
    }

    // Insert in dependency order.
    restored.chartOfAccounts = await insertBatches(
      "chart_of_accounts",
      (data.chartOfAccounts ?? []).map((account, index) => ({
        id: account.id,
        ...mockChartAccountToInsert({
          number: account.number,
          name: account.name,
          accountType: account.accountType,
          detailType: account.detailType,
          currency: account.currency,
          tax: account.tax,
          ledgerBalance: account.ledgerBalance,
          bankBalance: account.bankBalance,
          bankConnected: account.bankConnected,
          isActive: account.isActive,
          sortOrder: account.sortOrder ?? index + 1,
        }),
      })),
    );

    restored.customers = await insertBatches(
      "customers",
      (data.customers ?? []).map((customer, index) => ({
        id: customer.id,
        customer_name: customer.name.trim(),
        company_name:
          customer.companyName?.trim() &&
          customer.companyName.trim().toLowerCase() !== "none"
            ? customer.companyName.trim()
            : null,
        street_address: customer.profile?.street1?.trim() || null,
        city: customer.profile?.city?.trim() || null,
        state: customer.profile?.province?.trim() || null,
        country: customer.profile?.country?.trim() || null,
        zip: customer.profile?.zip?.trim() || null,
        phone: customer.phone?.trim() || null,
        email: customer.email?.trim() || null,
        currency: normalizeCustomerCurrency(customer.currency),
        attachment_count: customer.attachmentCount ?? 0,
        open_balance: customer.openBalance ?? 0,
        sort_order: index + 1,
      })),
    );

    restored.leads = await insertBatches(
      "leads",
      (data.leads ?? []).map((lead, index) => ({
        id: lead.id,
        lead_name: lead.name.trim(),
        company_name:
          lead.companyName?.trim() && lead.companyName.trim().toLowerCase() !== "none"
            ? lead.companyName.trim()
            : null,
        phone: lead.phone?.trim() || null,
        email: lead.email?.trim() || null,
        lead_source: lead.source?.trim() || null,
        status: lead.status?.trim() || "open",
        sort_order: index + 1,
      })),
    );

    restored.suppliers = await insertBatches(
      "suppliers",
      (data.suppliers ?? []).map((supplier, index) => ({
        id: supplier.id,
        supplier_name: supplier.name.trim(),
        company_name:
          supplier.companyName?.trim() &&
          supplier.companyName.trim().toLowerCase() !== "none"
            ? supplier.companyName.trim()
            : null,
        street_address: supplier.profile?.street1?.trim() || null,
        city: supplier.profile?.city?.trim() || null,
        state: supplier.profile?.province?.trim() || null,
        country: supplier.profile?.country?.trim() || null,
        zip: supplier.profile?.zip?.trim() || null,
        phone: supplier.phone?.trim() || null,
        email: supplier.email?.trim() || null,
        currency: normalizeSupplierCurrency(supplier.currency),
        open_balance: supplier.openBalance ?? 0,
        sort_order: index + 1,
      })),
    );

    restored.productServices = await insertBatches(
      "product_services",
      (data.productServices ?? []).map((product, index) => ({
        id: product.id,
        ...parsedProductServiceToInsert({
          rowNumber: index + 1,
          name: product.name,
          itemType: product.itemType,
          sku: product.sku,
          category: product.category,
          className: product.className,
          salesDescription: product.salesDescription,
          salesPrice: product.salesPrice,
          cost: product.cost,
          qtyOnHand: product.qtyOnHand,
          reorderPoint: product.reorderPoint,
          sortOrder: index + 1,
        }),
        is_custom: product.isCustom ?? false,
        is_active: product.isActive !== false,
        bundle_lines: product.bundleLines ?? null,
        display_bundle_components: product.displayBundleComponents ?? null,
      })),
    );

    restored.salesTransactions = await insertBatches(
      "sales_transactions",
      (data.salesTransactions ?? []).map((txn, index) => {
        const parsedDate = parseTransactionDate(txn.date);
        return {
          id: txn.id,
          transaction_date: parsedDate ? toIsoDate(parsedDate) : txn.date,
          transaction_type: txn.type,
          reference_number: txn.number.trim() || null,
          customer_name: txn.customer.trim() || null,
          memo: txn.memo.trim() || null,
          income_account_name: txn.incomeAccount?.trim() || null,
          amount: txn.amount,
          status: mockSalesStatusToDb(txn),
          sort_order: index + 1,
        };
      }),
    );

    const lineInserts: SalesTransactionLineInsert[] = [];
    for (const [reference, lines] of Object.entries(data.salesTransactionLines ?? {})) {
      lines.forEach((line, index) => {
        lineInserts.push({
          reference_number: reference,
          sort_order: index + 1,
          product_service: line.productService || null,
          description: line.description || null,
          quantity: line.qty,
          rate: line.rate,
          amount: line.qty * line.rate,
        });
      });
    }
    restored.salesTransactionLines = await replaceSalesTransactionLinesInDb(lineInserts);

    const locationMap = new Map<string, string>();
    for (const [reference, location] of Object.entries(data.salesTransactionLocations ?? {})) {
      if (reference.trim() && location.trim()) locationMap.set(reference.trim(), location.trim());
    }
    if (locationMap.size > 0) {
      await upsertSalesTransactionLocationsInDb(locationMap);
    }
    restored.salesTransactionLocations = locationMap.size;

    restored.expenseTransactions = await insertBatches(
      "expense_transactions",
      (data.expenseTransactions ?? []).map((expense, index) => ({
        id: expense.id,
        ...parsedExpenseToInsert({
          rowNumber: index + 1,
          date: expense.date,
          transactionType: expense.type,
          referenceNumber: expense.number,
          payee: expense.payee,
          category: expense.category,
          totalBeforeTax: expense.totalBeforeTax,
          salesTax: expense.salesTax,
          total: expense.total,
          isSplit: Boolean(expense.isSplit),
          status: expense.status ?? null,
          categoryAccountId: expense.categoryAccountId ?? null,
          sortOrder: index + 1,
        }),
        payment_account_id: expense.paymentAccountId ?? null,
      })),
    );

    restored.unpaidBills = await insertBatches(
      "unpaid_bills",
      (data.unpaidBills ?? []).map((bill, index) => ({
        id: bill.id,
        ...parsedUnpaidBillToInsert({
          rowNumber: index + 1,
          supplierName: bill.supplier,
          dueDate: bill.dueDate,
          billAmount: bill.billAmount,
          openBalance: bill.openBalance,
          status: bill.statusType === "overdue" ? "Overdue" : "Open",
          sortOrder: index + 1,
          billNo: bill.billNo,
        }),
      })),
    );

    restored.invoices = await insertBatches(
      "invoices",
      (data.invoices ?? []).map((invoice, index) => ({
        id: invoice.id,
        ...mockInvoiceToInsert({ ...invoice, sortOrder: index + 1 }),
        attachments: invoice.attachments?.length ? invoice.attachments : null,
      })),
    );

    restored.recurringTemplates = await insertBatches(
      "recurring_templates",
      (data.recurringTemplates ?? []).map((template, index) => ({
        id: template.id,
        ...mockRecurringTemplateToInsert({ ...template, sortOrder: index + 1 }),
      })),
    );
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Restore failed.");
    return { ok: false, restored, errors };
  }

  return { ok: errors.length === 0, restored, errors };
}
