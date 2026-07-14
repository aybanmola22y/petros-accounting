"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  SupplierFormDialog,
  type SupplierFormValues,
} from "@/components/supplier-form-dialog";
import { useSuppliers } from "@/hooks/use-suppliers";
import { createSupplierViaApi } from "@/lib/suppliers/api";
import { cn } from "@/lib/utils";

const ADD_SUPPLIER_VALUE = "__add_supplier__";

type SupplierSelectProps = {
  value: string;
  onValueChange: (supplierName: string, supplierId: string) => void;
  triggerClassName?: string;
  placeholder?: string;
};

export function SupplierSelect({
  value,
  onValueChange,
  triggerClassName = "h-10",
  placeholder = "Choose a supplier",
}: SupplierSelectProps) {
  const { toast } = useToast();
  const [newSupplierOpen, setNewSupplierOpen] = useState(false);

  const { suppliers } = useSuppliers();

  const sorted = useMemo(
    () => [...suppliers].sort((a, b) => a.name.localeCompare(b.name)),
    [suppliers],
  );

  async function handleSaveSupplier(values: SupplierFormValues) {
    try {
      const created = await createSupplierViaApi({
        name: values.name,
        companyName: values.companyName,
        phone: values.phone,
        email: values.email,
        currency: values.currency,
        openingBalance: values.openingBalance,
        profile: values.profile,
      });
      onValueChange(created.name, created.id);
      toast({ title: "Supplier added", description: `${created.name} is ready to use.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Save failed.";
      toast({
        title: message === "Supplier already exists" ? "Already exists" : "Could not save supplier",
        description:
          message === "Supplier already exists"
            ? `"${values.name}" is already in the list.`
            : message,
        variant: "destructive",
      });
      throw error;
    }
  }

  return (
    <>
      <Select
        value={value || undefined}
        onValueChange={(v) => {
          if (v === ADD_SUPPLIER_VALUE) {
            setNewSupplierOpen(true);
            return;
          }
          const match = sorted.find((s) => s.name === v);
          onValueChange(v, match?.id ?? "");
        }}
      >
        <SelectTrigger className={triggerClassName}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="max-h-[min(280px,var(--radix-select-content-available-height))] p-0">
          <SelectItem
            value={ADD_SUPPLIER_VALUE}
            className={cn(
              "rounded-none border-b border-border/60 bg-muted/40 py-2.5 pl-3 pr-8",
              "text-primary font-medium focus:bg-muted/60 focus:text-primary",
            )}
          >
            <span className="flex items-center gap-2">
              <Plus className="h-4 w-4 shrink-0" />
              Add new
            </span>
          </SelectItem>
          {sorted.map((s) => (
            <SelectItem
              key={s.id}
              value={s.name}
              className="py-2.5 pl-3 pr-8"
              endAdornment={
                <span className="text-xs italic text-muted-foreground">
                  Supplier
                </span>
              }
            >
              <span className="text-sm font-medium">{s.name}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <SupplierFormDialog
        open={newSupplierOpen}
        onOpenChange={setNewSupplierOpen}
        onSave={handleSaveSupplier}
      />
    </>
  );
}
