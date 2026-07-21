export type BankTransactionTab = "pending" | "posted" | "excluded";

export type BankTransactionRow = {
  id: string;
  glRowId: string | null;
  metaId: string | null;
  accountId: string;
  date: string;
  bankDescription: string;
  payeeName: string;
  categoryLabel: string;
  spent: number;
  received: number;
  status: BankTransactionTab;
  transactionType: string;
  refNumber: string;
  notes: string;
  /** True when this line exists only as bank feed (not yet in the GL). */
  isFeedOnly: boolean;
};

export type BankAccountSummary = {
  id: string;
  label: string;
  currency: string;
  bankBalance?: number;
  bookBalance: number;
  showBankBalance: boolean;
  needsAttention?: boolean;
  lastSyncedDays?: number;
  pendingCount: number;
};

export type BankTransactionsResponse = {
  account: BankAccountSummary | null;
  accounts: BankAccountSummary[];
  transactions: BankTransactionRow[];
  counts: Record<BankTransactionTab, number>;
};
