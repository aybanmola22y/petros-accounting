export type ManagementReportCategory = "Executive" | "Sales" | "Operations" | "Custom";

export type ManagementReport = {
  id: string;
  name: string;
  description: string;
  category: ManagementReportCategory;
  createdBy: string;
  lastModified: string;
  isBuiltIn: boolean;
};

export const BUILTIN_MANAGEMENT_REPORTS: ManagementReport[] = [
  {
    id: "company-overview",
    name: "Company Overview",
    description: "High-level snapshot of revenue, expenses, and cash position",
    category: "Executive",
    createdBy: "PetroBook",
    lastModified: "Built-in",
    isBuiltIn: true,
  },
  {
    id: "sales-performance",
    name: "Sales Performance",
    description: "Track sales trends, top customers, and collection efficiency",
    category: "Sales",
    createdBy: "PetroBook",
    lastModified: "Built-in",
    isBuiltIn: true,
  },
  {
    id: "expenses-performance",
    name: "Expenses Performance",
    description: "Break down spending by category, vendor, and time period",
    category: "Operations",
    createdBy: "PetroBook",
    lastModified: "Built-in",
    isBuiltIn: true,
  },
];

export type { ManagementReportPeriod } from "@/lib/report-date-utils";
export { MANAGEMENT_REPORT_PERIODS } from "@/lib/report-date-utils";
