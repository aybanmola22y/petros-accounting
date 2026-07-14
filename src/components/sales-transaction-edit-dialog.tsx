"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MockSalesTransaction } from "@/lib/mock-data/sales";

export type SalesTransactionEditValues = {
  date: string;
  number: string;
  customer: string;
  memo: string;
  amount: number;
  type: MockSalesTransaction["type"];
};

const EDITABLE_TYPES: MockSalesTransaction["type"][] = [
  "Payment",
  "Invoice",
  "Sales receipt",
  "Estimate",
  "Credit Note",
];

type SalesTransactionEditDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: MockSalesTransaction | null;
  customerNames: string[];
  mode?: "create" | "edit";
  createType?: MockSalesTransaction["type"];
  onSave: (values: SalesTransactionEditValues) => void;
};

function defaultDateLabel() {
  const now = new Date();
  return `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;
}

export function SalesTransactionEditDialog({
  open,
  onOpenChange,
  transaction,
  customerNames,
  mode = "edit",
  createType = "Sales receipt",
  onSave,
}: SalesTransactionEditDialogProps) {
  const [date, setDate] = useState("");
  const [number, setNumber] = useState("");
  const [customer, setCustomer] = useState("");
  const [memo, setMemo] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<MockSalesTransaction["type"]>(createType);

  useEffect(() => {
    if (!open) return;
    if (mode === "create") {
      setDate(defaultDateLabel());
      setNumber("");
      setCustomer(customerNames[0] ?? "");
      setMemo("");
      setAmount("");
      setType(createType);
      return;
    }
    if (transaction) {
      setDate(transaction.date);
      setNumber(transaction.number);
      setCustomer(transaction.customer);
      setMemo(transaction.memo);
      setAmount(String(transaction.amount));
      setType(transaction.type);
    }
  }, [open, mode, createType, transaction, customerNames]);

  function handleSubmit() {
    const parsed = Number.parseFloat(amount);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    onSave({
      date: date.trim(),
      number: number.trim(),
      customer: customer.trim(),
      memo: memo.trim(),
      amount: parsed,
      type,
    });
  }

  if (mode === "edit" && !transaction) return null;

  const titleType = mode === "create" ? createType : transaction?.type;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? `New ${titleType}` : `Edit ${transaction?.type}`}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-1">
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Date</Label>
            <Input className="h-10" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Type</Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as MockSalesTransaction["type"])}
              disabled={mode === "create"}
            >
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EDITABLE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t === "Credit Note" ? "Credit memo" : t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">No.</Label>
            <Input className="h-10" value={number} onChange={(e) => setNumber(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Customer</Label>
            <Select value={customer} onValueChange={setCustomer}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Select customer" />
              </SelectTrigger>
              <SelectContent>
                {customerNames.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Memo</Label>
            <Input className="h-10" value={memo} onChange={(e) => setMemo(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Amount (PHP)</Label>
            <Input
              className="h-10"
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit}>
            {mode === "create" ? "Create" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
