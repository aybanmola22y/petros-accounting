"use client";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { MockSalesTransaction } from "@/lib/mock-data/sales";
import { getSalesTransactionStatusDisplay } from "@/lib/sales-transaction-status-display";
import { formatPHP } from "@/views/financial-report-shared";

function statusLabel(txn: MockSalesTransaction) {
  return getSalesTransactionStatusDisplay(txn).label;
}

type SalesTransactionViewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: MockSalesTransaction | null;
  onEdit?: () => void;
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[140px_1fr] py-2 border-b border-border/50 last:border-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}

export function SalesTransactionViewDialog({
  open,
  onOpenChange,
  transaction,
  onEdit,
}: SalesTransactionViewDialogProps) {
  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {transaction.type} — {transaction.number}
          </DialogTitle>
        </DialogHeader>
        <dl className="px-1">
          <DetailRow label="Date" value={transaction.date} />
          <DetailRow label="Type" value={transaction.type} />
          <DetailRow label="No." value={transaction.number} />
          <DetailRow label="Customer" value={transaction.customer} />
          <DetailRow label="Memo" value={transaction.memo || "—"} />
          <DetailRow label="Amount" value={formatPHP(transaction.amount)} />
          <DetailRow label="Status" value={statusLabel(transaction)} />
        </dl>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {onEdit && (
            <Button type="button" onClick={onEdit}>
              Edit
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
