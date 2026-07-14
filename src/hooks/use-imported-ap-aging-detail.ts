"use client";

import { useCallback, useEffect, useState } from "react";
import type { ImportedApAgingDetailSnapshot } from "@/lib/ap-aging-detail-import";
import {
  readImportedApAgingDetailSnapshot,
  saveImportedApAgingDetailSnapshot,
} from "@/lib/ap-aging-detail-import";

export function useImportedApAgingDetailSnapshot() {
  const [snapshot, setSnapshot] = useState<ImportedApAgingDetailSnapshot | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/ap-aging-detail");
      const payload = (await response.json()) as {
        asOf?: string;
        lines?: ImportedApAgingDetailSnapshot["lines"];
        totalAmount?: number;
        totalOpenBalance?: number;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load A/P ageing detail.");
      }
      const cached = readImportedApAgingDetailSnapshot();
      const nextSnapshot: ImportedApAgingDetailSnapshot = {
        asOf: payload.asOf?.trim() || cached?.asOf || "",
        lines: payload.lines ?? [],
        totalAmount: payload.totalAmount ?? cached?.totalAmount,
        totalOpenBalance: payload.totalOpenBalance ?? cached?.totalOpenBalance,
      };
      if (nextSnapshot.lines.length > 0) {
        saveImportedApAgingDetailSnapshot(nextSnapshot);
        setSnapshot(nextSnapshot);
      } else {
        setSnapshot(null);
      }
      return nextSnapshot;
    } catch (error) {
      console.warn("Could not load A/P ageing detail from Supabase.", error);
      const cached = readImportedApAgingDetailSnapshot();
      setSnapshot(cached);
      return cached;
    }
  }, []);

  useEffect(() => {
    const cached = readImportedApAgingDetailSnapshot();
    if (cached?.lines.length) setSnapshot(cached);
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onImported = () => {
      void refresh();
    };
    window.addEventListener("ap-aging-detail-imported", onImported);
    return () => window.removeEventListener("ap-aging-detail-imported", onImported);
  }, [refresh]);

  return snapshot;
}
