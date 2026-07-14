import type { MockChartAccount } from "@/lib/mock-data/chart-of-accounts";

/** Cash/bank accounts use the QuickBooks bank register layout (payment/deposit columns). */
export function isBankRegisterAccount(account: MockChartAccount): boolean {
  return account.accountType === "Cash and cash equivalents";
}
