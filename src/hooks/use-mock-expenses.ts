"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { fetchWithSharedCache } from "@/lib/api-fetch-cache";
import type { MockExpenseTransaction } from "@/lib/mock-data/expenses";
import {
  getExpensesSnapshot,
  replaceExpensesInStore,
  subscribeMockStore,
} from "@/lib/mock-data";

const EMPTY_EXPENSES: MockExpenseTransaction[] = [];
const EXPENSES_CACHE_KEY = "expense-transactions";

async function loadExpensesFromApi(): Promise<MockExpenseTransaction[]> {
  const response = await fetch("/api/expense-transactions");
  const payload = (await response.json()) as {
    expenses?: MockExpenseTransaction[];
    error?: string;
  };
  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to load expense transactions.");
  }
  return payload.expenses ?? [];
}

export function useMockExpenses() {
  const expenses = useSyncExternalStore(
    subscribeMockStore,
    getExpensesSnapshot,
    () => EMPTY_EXPENSES,
  );

  const refresh = useCallback(async (force = false) => {
    try {
      const expensesList = await fetchWithSharedCache(
        EXPENSES_CACHE_KEY,
        loadExpensesFromApi,
        { force },
      );
      replaceExpensesInStore(expensesList);
    } catch (error) {
      console.warn("Could not load expenses from Supabase.", error);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return expenses;
}
