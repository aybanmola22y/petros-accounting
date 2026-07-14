"use client";

import { Suspense } from "react";
import { AccountQuickReport } from "@/views/account-quick-report";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AccountQuickReport />
    </Suspense>
  );
}
