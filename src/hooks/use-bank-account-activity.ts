"use client";

import { useCallback, useEffect, useState } from "react";
import type { BankAccountActivity } from "@/lib/general-ledger/repository";

type State = {
  activity: Record<string, BankAccountActivity>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

/** Loads per-bank-account transaction counts and latest activity for the dashboard. */
export function useBankAccountActivity(refreshKey = 0): State {
  const [activity, setActivity] = useState<Record<string, BankAccountActivity>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/general-ledger/bank-activity");
      const payload = (await response.json()) as {
        activity?: Record<string, BankAccountActivity>;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "Failed to load bank account activity.");
      setActivity(payload.activity ?? {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load bank account activity.");
      setActivity({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshKey]);

  return { activity, loading, error, refresh };
}
