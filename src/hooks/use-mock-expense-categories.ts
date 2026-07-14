"use client";

import { useSyncExternalStore } from "react";
import { getExpenseCategoriesSnapshot, subscribeMockStore } from "@/lib/mock-data";

export function useMockExpenseCategories() {
  return useSyncExternalStore(
    subscribeMockStore,
    getExpenseCategoriesSnapshot,
    getExpenseCategoriesSnapshot,
  );
}
