"use client";

import { useCallback, useEffect } from "react";
import type { MockCustomer } from "@/lib/mock-data/types";
import type { MockLead } from "@/lib/mock-data/types";
import {
  replaceCustomersInStore,
  replaceLeadsInStore,
} from "@/lib/mock-data/store";

/** Load customers and leads from Supabase into the in-memory store. */
export function useCustomersAndLeadsBootstrap() {
  const refresh = useCallback(async () => {
    try {
      const [customersRes, leadsRes] = await Promise.all([
        fetch("/api/customers"),
        fetch("/api/leads"),
      ]);

      if (customersRes.ok) {
        const payload = (await customersRes.json()) as { customers?: MockCustomer[] };
        replaceCustomersInStore(payload.customers ?? []);
      } else {
        // Avoid showing stale local seed/persisted rows when the API fails.
        replaceCustomersInStore([]);
      }

      if (leadsRes.ok) {
        const payload = (await leadsRes.json()) as { leads?: MockLead[] };
        replaceLeadsInStore(payload.leads ?? []);
      } else {
        // Avoid showing stale local seed/persisted rows when the API fails.
        replaceLeadsInStore([]);
      }
    } catch (error) {
      replaceCustomersInStore([]);
      replaceLeadsInStore([]);
      console.warn("Could not load customers/leads from Supabase.", error);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { refresh };
}
