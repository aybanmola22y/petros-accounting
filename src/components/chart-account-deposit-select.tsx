"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  addChartAccount,
  getActiveChartAccountsSorted,
  getChartAccountsSnapshot,
  subscribeMockStore,
} from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const ADD_CHART_ACCOUNT_VALUE = "__add_chart_account__";

const NEW_ACCOUNT_TYPE_OPTIONS = [
  "Cash and cash equivalents",
  "Accounts receivable",
  "Other current assets",
  "Accounts payable",
  "Credit card",
  "Other current liabilities",
  "Equity",
  "Income",
  "Expenses",
] as const;

type ChartAccountDepositSelectProps = {
  value: string;
  onValueChange: (accountId: string) => void;
  triggerClassName?: string;
  disabled?: boolean;
};

export function ChartAccountDepositSelect({
  value,
  onValueChange,
  triggerClassName,
  disabled = false,
}: ChartAccountDepositSelectProps) {
  const { toast } = useToast();
  const chartAccounts = useSyncExternalStore(
    subscribeMockStore,
    getChartAccountsSnapshot,
    getChartAccountsSnapshot,
  );

  const depositAccounts = useMemo(
    () => getActiveChartAccountsSorted(chartAccounts),
    [chartAccounts],
  );

  const [newAccountOpen, setNewAccountOpen] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountNumber, setNewAccountNumber] = useState("");
  const [newAccountType, setNewAccountType] = useState<string>(
    NEW_ACCOUNT_TYPE_OPTIONS[0],
  );

  function handleSelectChange(next: string) {
    if (next === ADD_CHART_ACCOUNT_VALUE) {
      setNewAccountOpen(true);
      return;
    }
    onValueChange(next);
  }

  function handleCreateAccount() {
    const name = newAccountName.trim();
    if (!name) {
      toast({
        title: "Account name required",
        description: "Enter a name for the new chart of accounts entry.",
        variant: "destructive",
      });
      return;
    }
    const number = newAccountNumber.trim() || `AUTO-${Date.now().toString().slice(-6)}`;
    const id = `coa-${Date.now()}`;
    addChartAccount({
      id,
      number,
      name,
      accountType: newAccountType,
      currency: "PHP",
      tax: "",
      ledgerBalance: 0,
      isActive: true,
    });
    onValueChange(id);
    toast({
      title: "Account added",
      description: `${name} is now available in Chart of Accounts and Deposit To.`,
    });
    setNewAccountName("");
    setNewAccountNumber("");
    setNewAccountType(NEW_ACCOUNT_TYPE_OPTIONS[0]);
    setNewAccountOpen(false);
  }

  const selectValue =
    value && depositAccounts.some((a) => a.id === value) ? value : undefined;

  return (
    <>
      <Select
        value={selectValue}
        onValueChange={handleSelectChange}
        disabled={disabled}
      >
        <SelectTrigger className={cn("h-10 w-full", triggerClassName)}>
          <SelectValue placeholder="Select account" />
        </SelectTrigger>
        <SelectContent className="max-h-[min(320px,var(--radix-select-content-available-height))]">
          <SelectItem
            value={ADD_CHART_ACCOUNT_VALUE}
            className="rounded-none border-b border-border/60 bg-muted/40 py-2.5 pl-3 pr-8 text-primary font-medium focus:bg-muted/60 focus:text-primary"
          >
            <span className="flex items-center gap-2">
              <Plus className="h-4 w-4 shrink-0" />
              Add new
            </span>
          </SelectItem>
          {depositAccounts.map((account) => (
            <SelectItem key={account.id} value={account.id} className="py-2 pl-3 pr-8">
              {account.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Dialog open={newAccountOpen} onOpenChange={setNewAccountOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New account</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Adds an account to Chart of Accounts and selects it for Deposit To.
          </p>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Account name</Label>
              <Input
                className="h-10"
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
                placeholder="e.g. Cash on hand"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Account number</Label>
              <Input
                className="h-10"
                value={newAccountNumber}
                onChange={(e) => setNewAccountNumber(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Account type</Label>
              <Select value={newAccountType} onValueChange={setNewAccountType}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NEW_ACCOUNT_TYPE_OPTIONS.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setNewAccountOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleCreateAccount}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
