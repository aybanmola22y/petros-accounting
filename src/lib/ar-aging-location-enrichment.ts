import type { MockSalesTransaction } from "@/lib/mock-data/sales";
import {
  importedArAgingDetailToLocationMap,
  parseArAgingDetailSpreadsheet,
  readImportedArAgingDetailLines,
  saveImportedArAgingDetailSnapshot,
} from "@/lib/ar-aging-detail-import";
import {
  isArAgingSummarySpreadsheet,
  parseArAgingSummarySpreadsheet,
  saveImportedArAgingSummarySnapshot,
  type ImportedArAgingSummarySnapshot,
} from "@/lib/ar-aging-summary-import";
import { readSpreadsheetRows, safeLocalStorageSet } from "@/lib/import-spreadsheet-utils";

const STORAGE_KEY = "ar-aging-location-by-number";

export type ImportArAgingReportResult = {
  count: number;
  kind: "summary" | "detail";
  salesTransactions?: MockSalesTransaction[];
};

export function readArAgingLocationByNumber(): Map<string, string> {
  const fromDetail = importedArAgingDetailToLocationMap(readImportedArAgingDetailLines());
  if (fromDetail.size > 0) return fromDetail;

  if (typeof window === "undefined") return new Map();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as Record<string, string>;
    return new Map(
      Object.entries(parsed).filter(
        ([number, location]) => number.trim() && location.trim(),
      ),
    );
  } catch {
    return new Map();
  }
}

export function saveArAgingLocationByNumber(map: Map<string, string>): void {
  safeLocalStorageSet(STORAGE_KEY, JSON.stringify(Object.fromEntries(map.entries())));
}

/** @deprecated Use importArAgingReport */
export async function importArAgingDetailLocations(
  file: File,
): Promise<{ count: number; salesTransactions?: MockSalesTransaction[] }> {
  const result = await importArAgingReport(file);
  return { count: result.count, salesTransactions: result.salesTransactions };
}

export async function importArAgingReport(file: File): Promise<ImportArAgingReportResult> {
  const { rows } = await readSpreadsheetRows(file);

  if (isArAgingSummarySpreadsheet(rows)) {
    const snapshot = await parseArAgingSummarySpreadsheet(file);

    const response = await fetch("/api/ar-aging-summary", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot),
    });

    const payload = (await response.json()) as {
      error?: string;
      snapshot?: ImportedArAgingSummarySnapshot;
    };
    if (!response.ok) {
      throw new Error(payload.error ?? "Could not save AR Ageing Summary to the database.");
    }

    saveImportedArAgingSummarySnapshot(payload.snapshot ?? snapshot);
    window.dispatchEvent(new Event("ar-aging-summary-imported"));
    return { count: snapshot.rows.length, kind: "summary" };
  }

  const snapshot = await parseArAgingDetailSpreadsheet(file);

  const response = await fetch("/api/ar-aging-detail", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(snapshot),
  });

  const payload = (await response.json()) as {
    error?: string;
    salesTransactions?: MockSalesTransaction[];
  };
  if (!response.ok) {
    throw new Error(payload.error ?? "Could not save AR Ageing Detail to the database.");
  }

  saveImportedArAgingDetailSnapshot(snapshot);
  saveArAgingLocationByNumber(importedArAgingDetailToLocationMap(snapshot.lines));

  window.dispatchEvent(new Event("ar-aging-detail-imported"));
  return {
    count: snapshot.lines.length,
    kind: "detail",
    salesTransactions: payload.salesTransactions,
  };
}
