"use client";

import { useCallback, useEffect, useState } from "react";
import type { ImportedArAgingDetailSnapshot } from "@/lib/ar-aging-detail-import";
import {
  readImportedArAgingDetailSnapshot,
  saveImportedArAgingDetailSnapshot,
} from "@/lib/ar-aging-detail-import";

export function useImportedArAgingDetailSnapshot() {
  // Always start null so SSR and the client's first paint match.
  const [snapshot, setSnapshot] = useState<ImportedArAgingDetailSnapshot | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/ar-aging-detail");
      const payload = (await response.json()) as {
        asOf?: string;
        lines?: ImportedArAgingDetailSnapshot["lines"];
        totalAmount?: number;
        totalOpenBalance?: number;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load AR ageing detail.");
      }
      const cached = readImportedArAgingDetailSnapshot();
      const nextSnapshot: ImportedArAgingDetailSnapshot = {
        asOf: payload.asOf?.trim() || cached?.asOf || "",
        lines: payload.lines ?? [],
        totalAmount: payload.totalAmount ?? cached?.totalAmount,
        totalOpenBalance: payload.totalOpenBalance ?? cached?.totalOpenBalance,
      };
      if (nextSnapshot.lines.length > 0) {
        saveImportedArAgingDetailSnapshot(nextSnapshot);
        setSnapshot(nextSnapshot);
      } else {
        setSnapshot(null);
      }
      return nextSnapshot;
    } catch (error) {
      console.warn("Could not load AR ageing detail from Supabase.", error);
      const cached = readImportedArAgingDetailSnapshot();
      setSnapshot(cached);
      return cached;
    }
  }, []);

  useEffect(() => {
    const cached = readImportedArAgingDetailSnapshot();
    if (cached?.lines.length) setSnapshot(cached);
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onImported = () => {
      void refresh();
    };
    window.addEventListener("ar-aging-detail-imported", onImported);
    return () => window.removeEventListener("ar-aging-detail-imported", onImported);
  }, [refresh]);

  return snapshot;
}

export function useImportedArAgingDetailLines() {
  const snapshot = useImportedArAgingDetailSnapshot();
  return snapshot?.lines ?? [];
}
