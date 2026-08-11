"use client";

import { Suspense } from "react";
import { Suppliers } from "@/views/suppliers";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Suppliers />
    </Suspense>
  );
}
