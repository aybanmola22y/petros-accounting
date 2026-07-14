"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { MockSupplier } from "@/lib/mock-data/suppliers";
import {
  getSuppliersSnapshot,
  replaceSuppliersInStore,
  subscribeMockStore,
} from "@/lib/mock-data";

const EMPTY_SUPPLIERS: MockSupplier[] = [];

export function useSuppliers() {
  const suppliers = useSyncExternalStore(
    subscribeMockStore,
    getSuppliersSnapshot,
    () => EMPTY_SUPPLIERS,
  );

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/suppliers");
      const payload = (await response.json()) as {
        suppliers?: MockSupplier[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load suppliers.");
      }
      replaceSuppliersInStore(payload.suppliers ?? []);
    } catch (error) {
      console.warn("Could not load suppliers from Supabase.", error);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { suppliers, refresh };
}
