"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
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
  addProductItemCategory,
  getProductItemCategoriesSnapshot,
  subscribeMockStore,
} from "@/lib/mock-data";
import { ProductClassSelect } from "@/components/product-class-select";
import { cn } from "@/lib/utils";

const ADD_PRODUCT_CATEGORY_VALUE = "__add_product_category__";
type ProductCategoryClassFieldsProps = {
  category: string;
  className: string;
  onCategoryChange: (value: string) => void;
  onClassChange: (value: string) => void;
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export function ProductCategoryClassFields({
  category,
  className: classValue,
  onCategoryChange,
  onClassChange,
}: ProductCategoryClassFieldsProps) {
  const { toast } = useToast();
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const categories = useSyncExternalStore(
    subscribeMockStore,
    getProductItemCategoriesSnapshot,
    getProductItemCategoriesSnapshot,
  );

  function saveCategory() {
    const name = newCategoryName.trim();
    if (!name) {
      toast({
        title: "Name required",
        description: "Enter an item category name.",
        variant: "destructive",
      });
      return;
    }
    const created = addProductItemCategory(name);
    if (!created) {
      toast({
        title: "Already exists",
        description: `"${name}" is already in the list.`,
        variant: "destructive",
      });
      return;
    }
    onCategoryChange(created.name);
    setNewCategoryOpen(false);
    setNewCategoryName("");
    toast({ title: "Category added", description: `${created.name} is ready to use.` });
  }

  return (
    <>
      <Field label="Category">
        <Select
          value={category || undefined}
          onValueChange={(v) => {
            if (v === ADD_PRODUCT_CATEGORY_VALUE) {
              setNewCategoryOpen(true);
              return;
            }
            onCategoryChange(v);
          }}
        >
          <SelectTrigger className="h-10">
            <SelectValue placeholder="Choose a category" />
          </SelectTrigger>
          <SelectContent className="max-h-[min(280px,var(--radix-select-content-available-height))] p-0">
            <SelectItem
              value={ADD_PRODUCT_CATEGORY_VALUE}
              className="rounded-none border-b border-border/60 bg-muted/40 py-2.5 pl-3 pr-8 text-primary font-medium focus:bg-muted/60 focus:text-primary"
            >
              <span className="flex items-center gap-2">
                <Plus className="h-4 w-4 shrink-0" />
                Add new
              </span>
            </SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.name} className="py-2.5 pl-3 pr-8">
                <span className="text-sm font-medium">{c.name}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Class">
        <ProductClassSelect value={classValue} onValueChange={onClassChange} />
      </Field>

      <Dialog
        open={newCategoryOpen}
        onOpenChange={(open) => {
          setNewCategoryOpen(open);
          if (!open) setNewCategoryName("");
        }}
      >
        <DialogContent className="max-w-sm gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle className="text-center text-lg font-semibold">
              New Category
            </DialogTitle>
          </DialogHeader>
          <div className="px-5 py-5">
            <Label className="text-xs text-muted-foreground">Item Category name</Label>
            <Input
              className="mt-1.5 h-10"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  saveCategory();
                }
              }}
            />
          </div>
          <DialogFooter className="border-t bg-muted/40 px-5 py-3">
            <Button type="button" className="ml-auto" onClick={saveCategory}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
}
