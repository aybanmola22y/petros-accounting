import type { ManagementReport } from "@/lib/management-reports-data";

const STORAGE_KEY = "petrobook_custom_management_reports";

export function readCustomManagementReports(): ManagementReport[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ManagementReport[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendCustomManagementReport(report: ManagementReport) {
  const existing = readCustomManagementReports();
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, report]));
}
