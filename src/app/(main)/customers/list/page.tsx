"use client";

import { Suspense } from "react";
import { CustomersAndLeads } from "@/views/customers-and-leads";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CustomersAndLeads />
    </Suspense>
  );
}
