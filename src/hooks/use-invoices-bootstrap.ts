"use client";

import { useCallback, useEffect } from "react";
import { fetchInvoicesFromApi } from "@/lib/invoices/api";
import { beginStoreBatch, endStoreBatch } from "@/lib/mock-data";

/** Load UI-created invoices from Supabase into the in-memory store. */
export function useInvoicesBootstrap() {
  const refresh = useCallback(async () => {
    beginStoreBatch();
    try {
      await fetchInvoicesFromApi();
    } catch (error) {
      console.warn("Could not load invoices from Supabase.", error);
    } finally {
      endStoreBatch();
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { refresh };
}
