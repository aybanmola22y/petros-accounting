"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CUSTOM_REPORTS_PATH,
  CUSTOM_REPORT_TAB_PARAM,
  CUSTOM_REPORT_DEFINITIONS,
  isCustomReportTabId,
  type CustomReportTabId,
} from "@/lib/custom-report-routes";
import { TransactionDetailByAccountReport } from "@/views/transaction-detail-by-account-report";
import { cn } from "@/lib/utils";

export function CustomReports() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<CustomReportTabId>(() => {
    const tab = searchParams.get(CUSTOM_REPORT_TAB_PARAM);
    return isCustomReportTabId(tab) ? tab : "transaction-detail-by-account";
  });

  useEffect(() => {
    const tab = searchParams.get(CUSTOM_REPORT_TAB_PARAM);
    if (isCustomReportTabId(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  function selectTab(tab: CustomReportTabId) {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set(CUSTOM_REPORT_TAB_PARAM, tab);
    router.replace(`${CUSTOM_REPORTS_PATH}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="custom-reports-page space-y-6 print:space-y-0">
      <div className="custom-reports-page-header space-y-1 print:hidden">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Reports
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Custom Reports</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          QuickBooks-style reports built from your imported expense transactions and chart of
          accounts.
        </p>
      </div>

      <div className="custom-reports-shell flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm lg:flex-row min-h-[480px] print:min-h-0 print:overflow-visible print:rounded-none print:border-0 print:bg-white print:shadow-none">
        <nav className="custom-reports-nav flex lg:flex-col gap-1 overflow-x-auto border-b lg:border-b-0 lg:border-r bg-muted/20 p-2 lg:w-72 lg:shrink-0 print:hidden">
          {CUSTOM_REPORT_DEFINITIONS.map((report) => {
            const active = activeTab === report.id;
            return (
              <button
                key={report.id}
                type="button"
                onClick={() => selectTab(report.id)}
                className={cn(
                  "relative shrink-0 rounded-lg px-3 py-2.5 text-left text-sm transition-all lg:w-full",
                  active
                    ? "bg-background font-medium text-foreground shadow-sm ring-1 ring-border"
                    : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
                )}
              >
                {active && (
                  <span className="absolute left-0 top-2 bottom-2 hidden w-0.5 rounded-full bg-primary lg:block" />
                )}
                <span className="block lg:pl-2">{report.shortLabel}</span>
                <span className="mt-0.5 hidden text-xs text-muted-foreground lg:block lg:pl-2">
                  {report.description}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="custom-reports-content flex-1 min-w-0 overflow-auto bg-background print:overflow-visible print:bg-white print:p-0">
          <div className="print-report-document">
            {activeTab === "transaction-detail-by-account" && (
              <TransactionDetailByAccountReport embedded />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
