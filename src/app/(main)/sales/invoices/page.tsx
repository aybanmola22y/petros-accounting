"use client";

import { Suspense } from "react";
import { Invoices } from "@/views/invoices";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Invoices />
    </Suspense>
  );
}
