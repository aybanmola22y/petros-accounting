"use client";

import { useCallback, useEffect, useState } from "react";
import type { MockExpenseTransaction } from "@/lib/mock-data/expenses";
import { replaceExpensesInStore } from "@/lib/mock-data/store";

type UseExpenseTransactionsResult = {
  expenses: MockExpenseTransaction[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useExpenseTransactions(): UseExpenseTransactionsResult {
  const [expenses, setExpenses] = useState<MockExpenseTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/expense-transactions");
      const payload = (await response.json()) as {
        expenses?: MockExpenseTransaction[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load expense transactions.");
      }
      const rows = payload.expenses ?? [];
      replaceExpensesInStore(rows);
      setExpenses(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load expense transactions.");
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { expenses, loading, error, refresh };
}
