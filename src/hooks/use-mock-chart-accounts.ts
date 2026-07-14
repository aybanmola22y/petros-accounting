"use client";

import { useSyncExternalStore } from "react";
import type { MockChartAccount } from "@/lib/mock-data/chart-of-accounts";
import { getChartAccountsSnapshot, subscribeMockStore } from "@/lib/mock-data";

const EMPTY_CHART_ACCOUNTS: MockChartAccount[] = [];

export function useMockChartAccounts() {
  return useSyncExternalStore(
    subscribeMockStore,
    getChartAccountsSnapshot,
    () => EMPTY_CHART_ACCOUNTS,
  );
}
