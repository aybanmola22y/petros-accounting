"use client";

import { useCallback, useEffect, useState } from "react";
import type { ImportedExpensesBySupplierSnapshot } from "@/lib/expenses-by-supplier-summary-import";
import {
  readImportedExpensesBySupplierSnapshot,
  saveImportedExpensesBySupplierSnapshot,
} from "@/lib/expenses-by-supplier-summary-import";

export function useImportedExpensesBySupplierSnapshot() {
  const [snapshot, setSnapshot] = useState<ImportedExpensesBySupplierSnapshot | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/expenses-by-supplier-summary");
      const payload = (await response.json()) as {
        periodLabel?: string;
        rows?: ImportedExpensesBySupplierSnapshot["rows"];
        totalAmount?: number;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load Expenses by Supplier Summary.");
      }
      const cached = readImportedExpensesBySupplierSnapshot();
      const nextSnapshot: ImportedExpensesBySupplierSnapshot = {
        periodLabel: payload.periodLabel?.trim() || cached?.periodLabel || "",
        rows: payload.rows ?? [],
        totalAmount: payload.totalAmount ?? cached?.totalAmount,
      };
      if (nextSnapshot.rows.length > 0) {
        saveImportedExpensesBySupplierSnapshot(nextSnapshot);
        setSnapshot(nextSnapshot);
      } else {
        setSnapshot(null);
      }
      return nextSnapshot;
    } catch (error) {
      console.warn("Could not load Expenses by Supplier Summary from Supabase.", error);
      const cached = readImportedExpensesBySupplierSnapshot();
      setSnapshot(cached);
      return cached;
    }
  }, []);

  useEffect(() => {
    const cached = readImportedExpensesBySupplierSnapshot();
    if (cached?.rows.length) setSnapshot(cached);
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onImported = () => {
      void refresh();
    };
    window.addEventListener("expenses-by-supplier-summary-imported", onImported);
    return () => window.removeEventListener("expenses-by-supplier-summary-imported", onImported);
  }, [refresh]);

  return snapshot;
}
