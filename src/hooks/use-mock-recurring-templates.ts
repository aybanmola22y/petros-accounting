"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { getRecurringTemplatesSnapshot, subscribeMockStore } from "@/lib/mock-data";
import type { MockRecurringTemplate } from "@/lib/mock-data/recurring-transactions";
import { fetchRecurringTemplatesFromApi } from "@/lib/recurring-templates/api";

const EMPTY_TEMPLATES: MockRecurringTemplate[] = [];

export function useMockRecurringTemplates() {
  const templates = useSyncExternalStore(
    subscribeMockStore,
    getRecurringTemplatesSnapshot,
    () => EMPTY_TEMPLATES,
  );

  const refresh = useCallback(async () => {
    try {
      await fetchRecurringTemplatesFromApi();
    } catch (error) {
      console.warn("Could not load recurring templates from Supabase.", error);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { templates, refresh };
}
