"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { MockSalesTransaction } from "@/lib/mock-data/sales";
import type { MockInvoiceLine } from "@/lib/mock-data/types";
import {
  getSalesTransactionsSnapshot,
  replaceSalesTransactionLinesInStore,
  replaceSalesTransactionsInStore,
  subscribeMockStore,
} from "@/lib/mock-data";

const EMPTY_SALES: MockSalesTransaction[] = [];

export function useMockSales() {
  const salesTransactions = useSyncExternalStore(
    subscribeMockStore,
    getSalesTransactionsSnapshot,
    () => EMPTY_SALES,
  );

  const refresh = useCallback(async () => {
    try {
      const linesPromise = fetch("/api/sales-transaction-lines")
        .then((res) => res.json() as Promise<{ lines?: Record<string, MockInvoiceLine[]> }>)
        .then((payload) => replaceSalesTransactionLinesInStore(payload.lines ?? {}))
        .catch((error) => {
          console.warn("Could not load invoice line items from Supabase.", error);
        });

      const response = await fetch("/api/sales-transactions");
      const payload = (await response.json()) as {
        salesTransactions?: MockSalesTransaction[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load sales transactions.");
      }
      replaceSalesTransactionsInStore(payload.salesTransactions ?? []);
      await linesPromise;
    } catch (error) {
      console.warn("Could not load sales transactions from Supabase.", error);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return salesTransactions;
}
