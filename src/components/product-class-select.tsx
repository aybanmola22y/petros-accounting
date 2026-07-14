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
  addProductItemClass,
  getProductItemClassesSnapshot,
  subscribeMockStore,
} from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const ADD_PRODUCT_CLASS_VALUE = "__add_product_class__";

type ProductClassSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  triggerClassName?: string;
  placeholder?: string;
  /** When provided, avoids a per-instance mock store subscription. */
  classes?: { id: string; name: string }[];
};

export function ProductClassSelect({
  value,
  onValueChange,
  triggerClassName = "h-10",
  placeholder = "Assign a class",
  classes: classesProp,
}: ProductClassSelectProps) {
  const { toast } = useToast();
  const [newClassOpen, setNewClassOpen] = useState(false);
  const [newClassName, setNewClassName] = useState("");

  const classesFromStore = useSyncExternalStore(
    classesProp ? () => () => {} : subscribeMockStore,
    getProductItemClassesSnapshot,
    getProductItemClassesSnapshot,
  );
  const classes = classesProp ?? classesFromStore;

  const sorted = useMemo(
    () => [...classes].sort((a, b) => a.name.localeCompare(b.name)),
    [classes],
  );

  function saveClass() {
    const name = newClassName.trim();
    if (!name) {
      toast({
        title: "Name required",
        description: "Enter a class name.",
        variant: "destructive",
      });
      return;
    }
    const created = addProductItemClass(name);
    if (!created) {
      toast({
        title: "Already exists",
        description: `"${name}" is already in the list.`,
        variant: "destructive",
      });
      return;
    }
    onValueChange(created.name);
    setNewClassOpen(false);
    setNewClassName("");
    toast({ title: "Class added", description: `${created.name} is ready to use.` });
  }

  return (
    <>
      <Select
        value={value || undefined}
        onValueChange={(v) => {
          if (v === ADD_PRODUCT_CLASS_VALUE) {
            setNewClassOpen(true);
            return;
          }
          onValueChange(v);
        }}
      >
        <SelectTrigger className={triggerClassName}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="max-h-[min(280px,var(--radix-select-content-available-height))] p-0">
          <SelectItem
            value={ADD_PRODUCT_CLASS_VALUE}
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
          {sorted.map((c) => (
            <SelectItem key={c.id} value={c.name} className="py-2.5 pl-3 pr-8">
              <span className="text-sm font-medium">{c.name}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Dialog
        open={newClassOpen}
        onOpenChange={(open) => {
          setNewClassOpen(open);
          if (!open) setNewClassName("");
        }}
      >
        <DialogContent className="max-w-sm gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle className="text-center text-lg font-semibold">New Class</DialogTitle>
          </DialogHeader>
          <div className="px-5 py-5">
            <Label className="text-xs text-muted-foreground">Class name</Label>
            <Input
              className="mt-1.5 h-10"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  saveClass();
                }
              }}
            />
          </div>
          <DialogFooter className="border-t bg-muted/40 px-5 py-3">
            <Button type="button" className="ml-auto" onClick={saveClass}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
