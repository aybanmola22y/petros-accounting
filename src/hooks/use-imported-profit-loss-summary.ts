"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProfitLossImportPackage } from "@/lib/profit-loss-summary/repository";

export function useImportedProfitLossSnapshot(): ProfitLossImportPackage | null {
  const [importPackage, setImportPackage] = useState<ProfitLossImportPackage | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/profit-loss-summary");
      const payload = (await response.json()) as {
        snapshot?: ProfitLossImportPackage["imported"] | null;
        baseline?: ProfitLossImportPackage["baseline"] | null;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load Profit and Loss.");
      }
      const imported = payload.snapshot ?? null;
      if (!imported?.rows.length) {
        setImportPackage(null);
        return null;
      }
      const next: ProfitLossImportPackage = {
        imported,
        baseline: payload.baseline ?? { periodLabel: imported.periodLabel, rows: [] },
      };
      setImportPackage(next);
      return next;
    } catch (error) {
      console.warn("Could not load Profit and Loss from Supabase.", error);
      setImportPackage(null);
      return null;
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onImported = () => {
      void refresh();
    };
    window.addEventListener("profit-loss-summary-imported", onImported);
    return () => window.removeEventListener("profit-loss-summary-imported", onImported);
  }, [refresh]);

  return importPackage;
}
