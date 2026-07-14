import type { ImportedProfitLossSnapshot } from "@/lib/profit-loss-summary-import";
import type { ReportLine } from "@/views/financial-report-shared";

function sectionRows(
  snapshot: ImportedProfitLossSnapshot,
  section: ImportedProfitLossSnapshot["rows"][number]["section"],
): ReportLine[] {
  return snapshot.rows
    .filter((row) => row.section === section)
    .map((row, index) => ({
      id: `pl-${section}-${index}-${row.accountName}`,
      label: row.accountName,
      amount: row.amount,
      isAccountLine: true,
    }));
}

function sumLines(lines: ReportLine[]): number {
  return lines.reduce((sum, line) => sum + (line.amount ?? 0), 0);
}

function buildSection(
  sectionId: string,
  headerLabel: string,
  totalLabel: string,
  accountRows: ReportLine[],
): ReportLine[] {
  if (accountRows.length === 0) return [];
  const total = sumLines(accountRows);
  return [
    { id: `${sectionId}-header`, label: headerLabel, isSectionHeader: true },
    ...accountRows,
    { id: `${sectionId}-total`, label: totalLabel, amount: total, isSectionTotal: true },
  ];
}

export function buildProfitAndLossLinesFromImport(
  snapshot: ImportedProfitLossSnapshot,
): ReportLine[] {
  const incomeRows = sectionRows(snapshot, "income");
  const cogsRows = sectionRows(snapshot, "cost_of_sales");
  const expenseRows = sectionRows(snapshot, "expenses");
  const otherIncomeRows = sectionRows(snapshot, "other_income");
  const otherExpenseRows = sectionRows(snapshot, "other_expenses");

  const income = sumLines(incomeRows);
  const costOfSales = sumLines(cogsRows);
  const expensesTotal = sumLines(expenseRows);
  const otherIncome = sumLines(otherIncomeRows);
  const otherExpenses = sumLines(otherExpenseRows);
  const grossProfit = income - costOfSales;
  const netEarnings = grossProfit - expensesTotal - otherExpenses + otherIncome;

  const lines: ReportLine[] = [
    ...buildSection("income", "Income", "Total Income", incomeRows),
    ...buildSection("cost-of-sales", "Cost of Sales", "Total Cost of Sales", cogsRows),
    {
      id: "gross-profit",
      label: "Gross Profit",
      amount: grossProfit,
      isSubtotal: true,
    },
    ...buildSection("expenses", "Expenses", "Total Expenses", expenseRows),
    ...buildSection("other-income", "Other Income", "Total Other Income", otherIncomeRows),
    ...buildSection("other-expenses", "Other Expenses", "Total Other Expenses", otherExpenseRows),
    {
      id: "net-earnings",
      label: "Net Earnings",
      amount: netEarnings,
      isGrandTotal: true,
    },
  ];

  return lines.filter((line) => {
    if (line.isSectionHeader || line.isAccountLine || line.isSectionTotal) return true;
    if (line.isSubtotal || line.isGrandTotal) return true;
    return (line.amount ?? 0) !== 0;
  });
}
