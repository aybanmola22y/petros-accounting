import { createExpenseViaApi, updateExpenseViaApi } from "@/lib/expense-transactions/api";
import { createUnpaidBillViaApi } from "@/lib/unpaid-bills/api";
import type { MockExpenseTransaction } from "@/lib/mock-data/expenses";

/** Persist a new expense, cheque, or bill payment to Supabase. */
export async function recordExpenseCreation(input: Omit<MockExpenseTransaction, "id">) {
  await createExpenseViaApi(input);
}

/** Persist bill updates to Supabase. */
export async function recordExpenseUpdate(
  id: string,
  patch: Partial<MockExpenseTransaction>,
) {
  await updateExpenseViaApi(id, patch);
}

/** Create an unpaid bill row and matching Bill expense transaction in Supabase. */
export async function recordBillCreation(input: {
  supplier: string;
  mailingAddress?: string;
  billDate: string;
  dueDate: string;
  billNo: string;
  billAmount: number;
  category?: string;
  lineDescription?: string;
  expenseCategory: string;
  isSplit?: boolean;
}) {
  await createUnpaidBillViaApi({
    supplierName: input.supplier,
    dueDate: input.dueDate,
    billAmount: input.billAmount,
    openBalance: input.billAmount,
    status: "Due on receipt",
  });

  await createExpenseViaApi({
    date: input.billDate,
    type: "Bill",
    number: input.billNo,
    payee: input.supplier,
    status: "pending",
    category: input.expenseCategory,
    ...(input.isSplit ? { isSplit: true } : {}),
    totalBeforeTax: input.billAmount,
    salesTax: 0,
    total: input.billAmount,
  });
}
