"use client";

import { Suspense } from "react";
import { SalesTransactions } from "@/views/sales-transactions";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SalesTransactions />
    </Suspense>
  );
}
