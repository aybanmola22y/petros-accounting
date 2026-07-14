"use client";

import { useCallback, useEffect, useState } from "react";
import type { BalanceSheetImportPackage } from "@/lib/balance-sheet-summary/repository";

export type BalanceSheetImportState = {
  importPackage: BalanceSheetImportPackage | null;
  isLoading: boolean;
};

export function useImportedBalanceSheetSnapshot(): BalanceSheetImportState {
  const [importPackage, setImportPackage] = useState<BalanceSheetImportPackage | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/balance-sheet-summary");
      const payload = (await response.json()) as {
        snapshot?: BalanceSheetImportPackage["imported"] | null;
        baseline?: BalanceSheetImportPackage["baseline"] | null;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load Balance Sheet.");
      }
      const imported = payload.snapshot ?? null;
      if (!imported?.rows.length) {
        setImportPackage(null);
        return null;
      }
      const next: BalanceSheetImportPackage = {
        imported,
        baseline: payload.baseline ?? { periodLabel: imported.periodLabel, rows: [] },
      };
      setImportPackage(next);
      return next;
    } catch (error) {
      console.warn("Could not load Balance Sheet from Supabase.", error);
      setImportPackage(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onImported = () => {
      void refresh();
    };
    window.addEventListener("balance-sheet-summary-imported", onImported);
    return () => window.removeEventListener("balance-sheet-summary-imported", onImported);
  }, [refresh]);

  return { importPackage, isLoading };
}
