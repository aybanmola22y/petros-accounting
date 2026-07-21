"use client";

import { useCallback, useEffect } from "react";
import { fetchWithSharedCache } from "@/lib/api-fetch-cache";
import { fetchInvoicesFromApi } from "@/lib/invoices/api";
import { beginStoreBatch, endStoreBatch, replaceSalesTransactionsInStore } from "@/lib/mock-data";
import type { MockSalesTransaction } from "@/lib/mock-data/sales";

const SALES_CACHE_KEY = "sales-transactions";

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

/**
 * Single batched bootstrap for the invoices page:
 * invoices + sales headers (no line items) → one store notify.
 */
export function useInvoicesPageBootstrap() {
  const refresh = useCallback(async () => {
    beginStoreBatch();
    try {
      const [, sales] = await Promise.all([
        fetchInvoicesFromApi().catch((error) => {
          console.warn("Could not load invoices from Supabase.", error);
          return null;
        }),
        fetchWithSharedCache(SALES_CACHE_KEY, loadSalesFromApi).catch((error) => {
          console.warn("Could not load sales transactions from Supabase.", error);
          return null;
        }),
      ]);
      if (sales) replaceSalesTransactionsInStore(sales);
    } finally {
      endStoreBatch();
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { refresh };
}
