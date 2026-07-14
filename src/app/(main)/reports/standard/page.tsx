"use client";

import { Suspense } from "react";
import { StandardReports } from "@/views/standard-reports";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <StandardReports />
    </Suspense>
  );
}
