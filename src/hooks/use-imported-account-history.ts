"use client";

import { useEffect, useState } from "react";
import type { GeneralLedgerAccountRow } from "@/lib/general-ledger/repository";

export type ImportedAccountHistory = {
  importExists: boolean;
  periodLabel: string;
  rows: GeneralLedgerAccountRow[];
};

type State = {
  data: ImportedAccountHistory | null;
  isLoading: boolean;
  error: string | null;
};

/** Loads imported QuickBooks General Ledger rows for a single chart account. */
export function useImportedAccountHistory(
  accountId: string | undefined,
  refreshKey = 0,
): State {
  const [state, setState] = useState<State>({ data: null, isLoading: true, error: null });

  useEffect(() => {
    if (!accountId) {
      setState({ data: null, isLoading: false, error: null });
      return;
    }

    let cancelled = false;
    setState({ data: null, isLoading: true, error: null });

    (async () => {
      try {
        const response = await fetch(
          `/api/general-ledger?accountId=${encodeURIComponent(accountId)}`,
        );
        const payload = (await response.json()) as ImportedAccountHistory & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Failed to load account history.");
        if (cancelled) return;
        setState({
          data: {
            importExists: payload.importExists ?? false,
            periodLabel: payload.periodLabel ?? "All Dates",
            rows: payload.rows ?? [],
          },
          isLoading: false,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        setState({
          data: null,
          isLoading: false,
          error: err instanceof Error ? err.message : "Failed to load account history.",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accountId, refreshKey]);

  return state;
}
