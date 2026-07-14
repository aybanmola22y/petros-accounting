"use client";

import { useSyncExternalStore } from "react";
import {
  getReceivablesSnapshot,
  getServerReceivablesSnapshot,
  subscribeMockStore,
} from "@/lib/mock-data";

export function useMockReceivables() {
  return useSyncExternalStore(
    subscribeMockStore,
    getReceivablesSnapshot,
    getServerReceivablesSnapshot,
  );
}
