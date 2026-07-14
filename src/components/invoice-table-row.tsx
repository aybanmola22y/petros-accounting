"use client";

import { memo, useCallback, useMemo, useState } from "react";
import { AlertCircle, Landmark, Wallet } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  LinkSplitAction,
  type LinkSplitActionMenuEntry,
} from "@/components/link-split-action";
import type { InvoiceViewRow } from "@/lib/mock-data";
import { formatPHP } from "@/views/financial-report-shared";
import { cn } from "@/lib/utils";

type InvoiceStatus = InvoiceViewRow["status"];

function StatusCell({ status }: { status: InvoiceStatus }) {
  if (status.kind === "void") {
    return <span className="text-sm text-muted-foreground font-medium">Voided</span>;
  }
  if (status.kind === "paid") {
    const deposited = status.detail === "Deposited";
    const DepositIcon = deposited ? Landmark : Wallet;
    return (
      <div className="flex items-start gap-2">
        <DepositIcon
          className={cn(
            "h-4 w-4 shrink-0 mt-0.5",
            deposited ? "text-emerald-600" : "text-amber-600",
          )}
          aria-hidden
        />
        <div>
          <p className="text-sm text-emerald-700 font-medium">Paid</p>
          <p
            className={cn(
              "text-xs",
              deposited ? "text-emerald-600 font-medium" : "text-amber-700",
            )}
          >
            {status.detail}
          </p>
        </div>
      </div>
    );
  }
  if (status.kind === "open") {
    return (
      <div>
        <p className="text-sm text-muted-foreground">Open</p>
        {status.detail && (
          <p className="text-xs text-muted-foreground">{status.detail}</p>
        )}
      </div>
    );
  }
  if (status.kind === "partial") {
    return (
      <div>
        <p className="text-sm font-medium text-amber-700">Partially paid</p>
        <p className="text-xs text-muted-foreground">{status.detail}</p>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2">
      <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-amber-700">Overdue</p>
        <p className="text-xs text-muted-foreground">{status.detail}</p>
        {status.sub && (
          <p className="text-xs text-muted-foreground/80">{status.sub}</p>
        )}
      </div>
    </div>
  );
}

function isDepositedInvoice(row: InvoiceViewRow): boolean {
  return row.status.kind === "paid" && row.status.detail === "Deposited";
}

export type InvoiceTableRowProps = {
  inv: InvoiceViewRow;
  index: number;
  isSelected: boolean;
  showInvoiceNumber: boolean;
  showBalance: boolean;
  showDueDate: boolean;
  onToggleSelect: (id: string) => void;
  onViewEdit: (inv: InvoiceViewRow) => void;
  onReceivePayment: (inv: InvoiceViewRow) => void;
  onPrint: (inv: InvoiceViewRow) => void;
  getActionMenu: (inv: InvoiceViewRow) => LinkSplitActionMenuEntry[];
};

export const InvoiceTableRow = memo(function InvoiceTableRow({
  inv,
  index,
  isSelected,
  showInvoiceNumber,
  showBalance,
  showDueDate,
  onToggleSelect,
  onViewEdit,
  onReceivePayment,
  onPrint,
  getActionMenu,
}: InvoiceTableRowProps) {
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const stripe = index % 2 === 0 ? "bg-background" : "bg-muted/15";
  const deposited = isDepositedInvoice(inv);

  const menuItems = useMemo(
    () => (actionMenuOpen ? getActionMenu(inv) : []),
    [actionMenuOpen, inv, getActionMenu],
  );

  const handleToggle = useCallback(() => {
    onToggleSelect(inv.id);
  }, [inv.id, onToggleSelect]);

  const handleViewEdit = useCallback(() => {
    onViewEdit(inv);
  }, [inv, onViewEdit]);

  const handleReceivePayment = useCallback(() => {
    onReceivePayment(inv);
  }, [inv, onReceivePayment]);

  const handlePrint = useCallback(() => {
    onPrint(inv);
  }, [inv, onPrint]);

  return (
    <tr
      className={cn(
        "border-b border-border/50 transition-colors hover:bg-muted/30",
        stripe,
        isSelected && "bg-primary/5",
      )}
    >
      <td className="px-4 py-3">
        <Checkbox
          checked={isSelected}
          onCheckedChange={handleToggle}
          aria-label={`Select invoice ${inv.number}`}
        />
      </td>
      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
        {inv.date}
      </td>
      {showInvoiceNumber && (
        <td className="px-4 py-3 font-mono text-xs">{inv.number}</td>
      )}
      <td className="px-4 py-3 font-medium">{inv.customer}</td>
      <td className="px-4 py-3 text-right tabular-nums font-medium whitespace-nowrap">
        {formatPHP(inv.amount)}
      </td>
      {showBalance && (
        <td className="px-4 py-3 text-right tabular-nums font-medium whitespace-nowrap">
          {formatPHP(inv.balance)}
        </td>
      )}
      {showDueDate && (
        <td className="px-4 py-3 text-left text-muted-foreground whitespace-nowrap">
          {inv.dueDate}
        </td>
      )}
      <td className="px-4 py-3">
        <StatusCell status={inv.status} />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            className="text-sm font-medium text-primary hover:underline"
            onClick={handleViewEdit}
          >
            View/Edit
          </button>
          <span className="text-muted-foreground/50" aria-hidden>
            |
          </span>
          <div onPointerDownCapture={() => setActionMenuOpen(true)}>
            {deposited ? (
              <LinkSplitAction
                label="Print"
                onPrimaryClick={handlePrint}
                menuItems={menuItems}
                menuClassName="w-52"
              />
            ) : (
              <LinkSplitAction
                label="Receive payment"
                onPrimaryClick={handleReceivePayment}
                menuItems={menuItems}
                menuClassName="w-52"
              />
            )}
          </div>
        </div>
      </td>
    </tr>
  );
});
