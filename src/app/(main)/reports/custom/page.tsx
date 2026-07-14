"use client";

import { Suspense } from "react";
import { CustomReports } from "@/views/custom-reports";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CustomReports />
    </Suspense>
  );
}
