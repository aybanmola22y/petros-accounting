import { getSalesTransactionStatusDisplay } from "@/lib/sales-transaction-status-display";
import type { MockSalesTransaction } from "@/lib/mock-data/sales";

function csvCell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function exportSalesTransactionsCsv(
  rows: readonly MockSalesTransaction[],
  openBalances?: ReadonlyMap<string, number>,
) {
  const headers = ["Date", "Type", "No.", "Customer", "Memo", "Amount", "Status"];
  const lines = rows.map((row) =>
    [
      row.date,
      row.type,
      row.number,
      row.customer,
      row.memo,
      row.amount,
      getSalesTransactionStatusDisplay(row, { openBalances }).label,
    ]
      .map(csvCell)
      .join(","),
  );
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `sales-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
