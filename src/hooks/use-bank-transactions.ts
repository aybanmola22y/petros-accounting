"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  BankTransactionRow,
  BankTransactionTab,
  BankTransactionsResponse,
} from "@/lib/bank-transactions/types";

type UseBankTransactionsOptions = {
  accountId: string | null;
  tab: BankTransactionTab;
  search: string;
};

export function useBankTransactions({
  accountId,
  tab,
  search,
}: UseBankTransactionsOptions) {
  const [data, setData] = useState<BankTransactionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!accountId) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ accountId, tab });
      if (search.trim()) params.set("search", search.trim());
      const response = await fetch(`/api/bank-transactions?${params.toString()}`);
      const payload = (await response.json()) as BankTransactionsResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Failed to load bank transactions.");
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load bank transactions.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [accountId, tab, search]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

export async function patchBankTransaction(
  id: string,
  body: {
    accountId: string;
    glRowId?: string | null;
    status?: BankTransactionTab;
    categoryLabel?: string;
    payeeName?: string;
    bankDescription?: string;
    notes?: string;
    action?: "post";
  },
): Promise<void> {
  const response = await fetch(`/api/bank-transactions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Update failed.");
}

export async function createBankFeedLine(body: {
  accountId: string;
  txnDate: string;
  bankDescription: string;
  payeeName?: string;
  categoryLabel?: string;
  direction: "deposit" | "payment";
  amount: number;
  notes?: string;
}): Promise<void> {
  const response = await fetch("/api/bank-transactions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Could not add bank line.");
}

export type { BankTransactionRow, BankTransactionTab, BankTransactionsResponse };
