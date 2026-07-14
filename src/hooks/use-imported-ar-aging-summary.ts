"use client";

import { useCallback, useEffect, useState } from "react";
import type { ImportedArAgingSummarySnapshot } from "@/lib/ar-aging-summary-import";
import { readImportedArAgingSummarySnapshot } from "@/lib/ar-aging-summary-import";

export function useImportedArAgingSummarySnapshot() {
  // Always start null so SSR and the client's first paint match (localStorage is
  // unavailable on the server and would otherwise cause a hydration mismatch).
  const [snapshot, setSnapshot] = useState<ImportedArAgingSummarySnapshot | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/ar-aging-summary");
      const payload = (await response.json()) as {
        snapshot?: ImportedArAgingSummarySnapshot | null;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load AR ageing summary.");
      }
      const nextSnapshot = payload.snapshot ?? null;
      setSnapshot(nextSnapshot?.rows.length ? nextSnapshot : null);
      return nextSnapshot;
    } catch (error) {
      console.warn("Could not load AR ageing summary from Supabase.", error);
      const cached = readImportedArAgingSummarySnapshot();
      setSnapshot(cached);
      return cached;
    }
  }, []);

  useEffect(() => {
    const cached = readImportedArAgingSummarySnapshot();
    if (cached?.rows.length) setSnapshot(cached);
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onImported = () => {
      void refresh();
    };
    window.addEventListener("ar-aging-summary-imported", onImported);
    return () => window.removeEventListener("ar-aging-summary-imported", onImported);
  }, [refresh]);

  return snapshot;
}
