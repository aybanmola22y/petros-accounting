"use client";

import { Suspense } from "react";
import { ExpenseTransactions } from "@/views/expense-transactions";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ExpenseTransactions />
    </Suspense>
  );
}
