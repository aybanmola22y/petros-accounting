"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { MockExpenseTransaction } from "@/lib/mock-data/expenses";
import {
  getExpensesSnapshot,
  replaceExpensesInStore,
  subscribeMockStore,
} from "@/lib/mock-data";

const EMPTY_EXPENSES: MockExpenseTransaction[] = [];

export function useMockExpenses() {
  const expenses = useSyncExternalStore(
    subscribeMockStore,
    getExpensesSnapshot,
    () => EMPTY_EXPENSES,
  );

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/expense-transactions");
      const payload = (await response.json()) as {
        expenses?: MockExpenseTransaction[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load expense transactions.");
      }
      replaceExpensesInStore(payload.expenses ?? []);
    } catch (error) {
      console.warn("Could not load expenses from Supabase.", error);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return expenses;
}
