"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSuppliersSnapshot, subscribeMockStore } from "@/lib/mock-data";

type PreferredSupplierSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  triggerClassName?: string;
};

export function PreferredSupplierSelect({
  value,
  onValueChange,
  triggerClassName = "h-10",
}: PreferredSupplierSelectProps) {
  const suppliers = useSyncExternalStore(
    subscribeMockStore,
    getSuppliersSnapshot,
    getSuppliersSnapshot,
  );

  const sorted = useMemo(
    () => [...suppliers].sort((a, b) => a.name.localeCompare(b.name)),
    [suppliers],
  );

  return (
    <Select value={value || undefined} onValueChange={onValueChange}>
      <SelectTrigger className={triggerClassName}>
        <SelectValue placeholder="Select a preferred supplier" />
      </SelectTrigger>
      <SelectContent className="max-h-[min(280px,var(--radix-select-content-available-height))]">
        {sorted.map((s) => (
          <SelectItem key={s.id} value={s.name} className="py-2.5 pl-3 pr-8">
            <span className="text-sm font-medium">{s.name}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
