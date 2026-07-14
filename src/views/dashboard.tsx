"use client";

import { BankAccountsSummaryCard } from "@/components/bank-accounts-summary-card";
import { DashboardCreateActions } from "@/components/dashboard-create-actions";
import { ExpensesSummaryCard } from "@/components/expenses-summary-card";
import { ProfitLossSummaryCard } from "@/components/profit-loss-summary-card";
import { SalesSummaryCard } from "@/components/sales-summary-card";

export function Dashboard() {
  return (
    <div className="space-y-6 w-full">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Home
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      </div>

      <DashboardCreateActions />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <ProfitLossSummaryCard />

        <ExpensesSummaryCard />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <SalesSummaryCard />
        <BankAccountsSummaryCard />
      </div>
    </div>
  );
}
