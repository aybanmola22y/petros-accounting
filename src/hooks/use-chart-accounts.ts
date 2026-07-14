"use client";

import { useCallback, useEffect, useState } from "react";
import type { MockChartAccount } from "@/lib/mock-data/chart-of-accounts";
import { replaceChartAccountsInStore } from "@/lib/mock-data/store";

type UseChartAccountsResult = {
  accounts: MockChartAccount[];
  loading: boolean;
  error: string | null;
  refresh: (options?: { syncGl?: boolean }) => Promise<void>;
};

export function useChartAccounts(): UseChartAccountsResult {
  const [accounts, setAccounts] = useState<MockChartAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (options?: { syncGl?: boolean }) => {
    setLoading(true);
    setError(null);
    try {
      const url = options?.syncGl ? "/api/chart-of-accounts?syncGl=1" : "/api/chart-of-accounts";
      const response = await fetch(url);
      const payload = (await response.json()) as {
        accounts?: MockChartAccount[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load chart of accounts.");
      }
      const accounts = payload.accounts ?? [];
      replaceChartAccountsInStore(accounts);
      setAccounts(accounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load chart of accounts.");
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { accounts, loading, error, refresh };
}
