import type { GeneralLedgerAccountRow } from "@/lib/general-ledger/repository";
import type { BankTransactionTab } from "./types";

const UNCategorized_PATTERN =
  /^(uncategorized expense|uncategorized income|uncategorized asset|split)$/i;

/** Bank-statement style descriptions that usually need review before posting. */
const BANK_FEED_DESCRIPTION_PATTERN =
  /\b(ck#|check #|atm|inter-?bank|fund transfer|pos |debit card|credit card|withdrawal|deposit ref)\b/i;

export function inferDefaultBankStatus(row: GeneralLedgerAccountRow): BankTransactionTab {
  const split = row.splitAccount.trim();
  if (!split || UNCategorized_PATTERN.test(split)) {
    return "pending";
  }
  const description = `${row.description} ${row.payeeName}`.trim();
  if (BANK_FEED_DESCRIPTION_PATTERN.test(description) && !row.payeeName.trim()) {
    return "pending";
  }
  return "posted";
}

export function formatGlDisplayDate(rawDate: string, isoDate: string | null): string {
  if (isoDate && /^\d{4}-\d{2}-\d{2}/.test(isoDate)) {
    const [year, month, day] = isoDate.slice(0, 10).split("-");
    return `${Number(month)}/${Number(day)}/${year}`;
  }
  return rawDate || "—";
}
