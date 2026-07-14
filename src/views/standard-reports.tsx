"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArAgingReport } from "@/views/ar-aging-report";
import { BalanceSheetReport } from "@/views/balance-sheet-report";
import { ProfitAndLossReport } from "@/views/profit-and-loss-report";
import { cn } from "@/lib/utils";
import {
  isStandardReportTabId,
  STANDARD_REPORTS_PATH,
  STANDARD_REPORT_TAB_PARAM,
  type StandardReportTabId,
} from "@/lib/standard-report-routes";

const STANDARD_REPORT_TABS = [
  {
    id: "ar-aging",
    label: "Accounts receivable aging summary",
    shortLabel: "AR Aging",
  },
  {
    id: "balance-sheet",
    label: "Balance Sheet",
    shortLabel: "Balance Sheet",
  },
  {
    id: "profit-and-loss",
    label: "Profit and Loss",
    shortLabel: "Profit & Loss",
  },
] as const;

type TabId = StandardReportTabId;

export function StandardReports() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    const tab = searchParams.get(STANDARD_REPORT_TAB_PARAM);
    return isStandardReportTabId(tab) ? tab : "ar-aging";
  });

  useEffect(() => {
    const tab = searchParams.get(STANDARD_REPORT_TAB_PARAM);
    if (isStandardReportTabId(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    const onPopState = () => {
      const tab = new URLSearchParams(window.location.search).get(STANDARD_REPORT_TAB_PARAM);
      if (isStandardReportTabId(tab)) {
        setActiveTab(tab);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function selectTab(tab: TabId) {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set(STANDARD_REPORT_TAB_PARAM, tab);
    const url = `${STANDARD_REPORTS_PATH}?${params.toString()}`;
    window.history.replaceState(window.history.state, "", url);
  }

  return (
    <div className="standard-reports-page space-y-6 print:space-y-0">
      <div className="standard-reports-page-header space-y-1 print:hidden">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Reports
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Standard Reports</h1>
        <p className="text-sm text-muted-foreground">
          Core financial statements and receivables analysis
        </p>
      </div>

      <div className="standard-reports-shell flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm lg:flex-row min-h-[480px] print:min-h-0 print:overflow-visible print:rounded-none print:border-0 print:bg-white print:shadow-none">
        <nav className="standard-reports-nav flex lg:flex-col gap-1 overflow-x-auto border-b lg:border-b-0 lg:border-r bg-muted/20 p-2 lg:w-64 lg:shrink-0 print:hidden">
          {STANDARD_REPORT_TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => selectTab(tab.id)}
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
                <span className="block lg:pl-2">{tab.shortLabel}</span>
                <span className="mt-0.5 hidden text-xs text-muted-foreground lg:block lg:pl-2">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="standard-reports-content flex-1 p-4 md:p-6 min-w-0 overflow-auto bg-background print:overflow-visible print:bg-white print:p-0">
          <div className="print-report-document">
            {activeTab === "ar-aging" && <ArAgingReport />}
            {activeTab === "balance-sheet" && <BalanceSheetReport />}
            {activeTab === "profit-and-loss" && <ProfitAndLossReport />}
          </div>
        </div>
      </div>
    </div>
  );
}
