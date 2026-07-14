"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { UnpaidBill } from "@/lib/mock-data/unpaid-bills";
import {
  getUnpaidBillsSnapshot,
  replaceUnpaidBillsInStore,
  subscribeMockStore,
} from "@/lib/mock-data";

const EMPTY_UNPAID_BILLS: UnpaidBill[] = [];

export function useUnpaidBills() {
  const unpaidBills = useSyncExternalStore(
    subscribeMockStore,
    getUnpaidBillsSnapshot,
    () => EMPTY_UNPAID_BILLS,
  );

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/unpaid-bills");
      const payload = (await response.json()) as {
        unpaidBills?: UnpaidBill[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load unpaid bills.");
      }
      replaceUnpaidBillsInStore(payload.unpaidBills ?? []);
    } catch (error) {
      console.warn("Could not load unpaid bills from Supabase.", error);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { unpaidBills, refresh };
}
