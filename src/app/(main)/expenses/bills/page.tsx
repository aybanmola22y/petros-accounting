"use client";

import { Suspense } from "react";
import { Bills } from "@/views/bills";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Bills />
    </Suspense>
  );
}
