"use client";

import { Suspense } from "react";
import { SalesOverview } from "@/views/sales-overview";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SalesOverview />
    </Suspense>
  );
}
