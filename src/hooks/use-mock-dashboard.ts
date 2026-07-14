"use client";

import { useSyncExternalStore } from "react";
import { getDashboardSnapshot, subscribeMockStore } from "@/lib/mock-data";

export function useMockDashboard() {
  return useSyncExternalStore(subscribeMockStore, getDashboardSnapshot, getDashboardSnapshot);
}
