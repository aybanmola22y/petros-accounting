import {
  deleteExpenses,
  replaceExpensesInStore,
  upsertExpenseInStore,
} from "@/lib/mock-data/store";
import type { MockExpenseTransaction } from "@/lib/mock-data/expenses";

type ExpenseListResponse = {
  expenses?: MockExpenseTransaction[];
  expense?: MockExpenseTransaction;
  ids?: string[];
  error?: string;
};

async function readExpenseResponse(response: Response): Promise<ExpenseListResponse> {
  return (await response.json()) as ExpenseListResponse;
}

export async function fetchExpensesFromApi(): Promise<MockExpenseTransaction[]> {
  const response = await fetch("/api/expense-transactions");
  const payload = await readExpenseResponse(response);
  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to load expense transactions.");
  }
  const expenses = payload.expenses ?? [];
  replaceExpensesInStore(expenses);
  return expenses;
}

export async function createExpenseViaApi(
  input: Omit<MockExpenseTransaction, "id">,
): Promise<MockExpenseTransaction> {
  const response = await fetch("/api/expense-transactions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expense: input }),
  });
  const payload = await readExpenseResponse(response);
  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to create expense transaction.");
  }
  if (!payload.expense) {
    throw new Error("Expense was not returned from the server.");
  }
  upsertExpenseInStore(payload.expense);
  return payload.expense;
}

export async function updateExpenseViaApi(
  id: string,
  patch: Partial<MockExpenseTransaction>,
): Promise<MockExpenseTransaction> {
  const response = await fetch("/api/expense-transactions", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, patch }),
  });
  const payload = await readExpenseResponse(response);
  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to update expense transaction.");
  }
  if (!payload.expense) {
    throw new Error("Expense was not returned from the server.");
  }
  upsertExpenseInStore(payload.expense);
  return payload.expense;
}

export async function deleteExpensesViaApi(ids: string[]): Promise<void> {
  const response = await fetch("/api/expense-transactions", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  const payload = await readExpenseResponse(response);
  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to delete expense transactions.");
  }
  deleteExpenses(payload.ids ?? ids);
}
