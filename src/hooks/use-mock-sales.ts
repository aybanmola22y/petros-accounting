"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { fetchWithSharedCache } from "@/lib/api-fetch-cache";
import type { MockSalesTransaction } from "@/lib/mock-data/sales";
import type { MockInvoiceLine } from "@/lib/mock-data/types";
import {
  beginStoreBatch,
  endStoreBatch,
  getSalesTransactionsSnapshot,
  replaceSalesTransactionLinesInStore,
  replaceSalesTransactionsInStore,
  subscribeMockStore,
} from "@/lib/mock-data";

const EMPTY_SALES: MockSalesTransaction[] = [];
const SALES_CACHE_KEY = "sales-transactions";
const LINES_CACHE_KEY = "sales-transaction-lines";

async function loadSalesFromApi(): Promise<MockSalesTransaction[]> {
  const response = await fetch("/api/sales-transactions");
  const payload = (await response.json()) as {
    salesTransactions?: MockSalesTransaction[];
    error?: string;
  };
  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to load sales transactions.");
  }
  return payload.salesTransactions ?? [];
}

async function loadSalesLinesFromApi(): Promise<Record<string, MockInvoiceLine[]>> {
  const response = await fetch("/api/sales-transaction-lines");
  const payload = (await response.json()) as {
    lines?: Record<string, MockInvoiceLine[]>;
  };
  return payload.lines ?? {};
}

type UseMockSalesOptions = {
  /** When false, skip the heavy lines payload (invoice list doesn't need it). Default true. */
  includeLines?: boolean;
};

export function useMockSales(options: UseMockSalesOptions = {}) {
  const includeLines = options.includeLines !== false;

  const salesTransactions = useSyncExternalStore(
    subscribeMockStore,
    getSalesTransactionsSnapshot,
    () => EMPTY_SALES,
  );

  const refresh = useCallback(
    async (force = false) => {
      try {
        beginStoreBatch();
        try {
          const linesPromise =
            includeLines
              ? fetchWithSharedCache(LINES_CACHE_KEY, loadSalesLinesFromApi, { force })
                  .then((lines) => replaceSalesTransactionLinesInStore(lines))
                  .catch((error) => {
                    console.warn("Could not load invoice line items from Supabase.", error);
                  })
              : Promise.resolve();

          const sales = await fetchWithSharedCache(SALES_CACHE_KEY, loadSalesFromApi, {
            force,
          });
          replaceSalesTransactionsInStore(sales);
          await linesPromise;
        } finally {
          endStoreBatch();
        }
      } catch (error) {
        console.warn("Could not load sales transactions from Supabase.", error);
      }
    },
    [includeLines],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return salesTransactions;
}

/** Prefetch sales line items once (e.g. when opening the invoice form). */
export async function prefetchSalesTransactionLines(force = false): Promise<void> {
  try {
    const lines = await fetchWithSharedCache(LINES_CACHE_KEY, loadSalesLinesFromApi, {
      force,
    });
    replaceSalesTransactionLinesInStore(lines);
  } catch (error) {
    console.warn("Could not load invoice line items from Supabase.", error);
  }
}
