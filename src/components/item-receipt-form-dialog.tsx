"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  Copy,
  GripVertical,
  HelpCircle,
  MessageSquare,
  Paperclip,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { ProductServiceCreateFlow } from "@/components/product-service-create-flow";
import { SupplierSelect } from "@/components/supplier-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getProductServicesSnapshot, subscribeMockStore } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export type ItemReceiptLine = {
  id: string;
  productService: string;
  sku: string;
  rate: number;
  qtyReceived: number;
};

export type ItemReceiptFormValues = {
  supplier: string;
  supplierId: string;
  date: string;
  receiptNo: string;
  lines: ItemReceiptLine[];
  memo: string;
};

const ADD_PRODUCT_SERVICE_VALUE = "__add_product_service__";

const LINE_TABLE_CELL = "px-2 py-1.5 align-middle";
const LINE_TABLE_FIELD = "h-9 border-0 bg-transparent px-2 shadow-none";
const LINE_TABLE_SELECT = "h-9 w-full border-0 bg-transparent px-2 shadow-none";
const LINE_TABLE_CENTER_HEADER = "px-2 py-2 text-center align-middle font-medium";
const LINE_TABLE_CENTER_CELL = "px-2 py-1.5 text-center align-middle";
const LINE_TABLE_CENTER_FIELD =
  "h-9 min-w-[5rem] border-0 bg-transparent px-2 text-center shadow-none tabular-nums";

function todayFormatted() {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}

function newLine(): ItemReceiptLine {
  return {
    id: `ir-line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    productService: "",
    sku: "",
    rate: 0,
    qtyReceived: 0,
  };
}

function defaultFormState(receiptNumber: string): ItemReceiptFormValues {
  return {
    supplier: "",
    supplierId: "",
    date: todayFormatted(),
    receiptNo: receiptNumber,
    lines: [newLine(), newLine()],
    memo: "",
  };
}

function lineTotal(line: ItemReceiptLine) {
  return (Number(line.qtyReceived) || 0) * (Number(line.rate) || 0);
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

type ItemReceiptFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receiptNumber: string;
  onSave: (values: ItemReceiptFormValues) => void;
  onSaveAndNew?: () => string;
  prefill?: ItemReceiptFormValues | null;
};

export function ItemReceiptFormDialog({
  open,
  onOpenChange,
  receiptNumber,
  onSave,
  onSaveAndNew,
  prefill = null,
}: ItemReceiptFormDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autofillInputRef = useRef<HTMLInputElement>(null);
  const prefillAppliedRef = useRef(false);
  const [form, setForm] = useState<ItemReceiptFormValues>(() =>
    defaultFormState(receiptNumber),
  );
  const [attachments, setAttachments] = useState<{ name: string }[]>([]);
  const [productServiceSelectLineId, setProductServiceSelectLineId] = useState<string | null>(
    null,
  );
  const [addProductForLineId, setAddProductForLineId] = useState<string | null>(null);
  const [newProductServiceOpen, setNewProductServiceOpen] = useState(false);

  const productServices = useSyncExternalStore(
    subscribeMockStore,
    getProductServicesSnapshot,
    getProductServicesSnapshot,
  );

  useEffect(() => {
    if (!open) {
      prefillAppliedRef.current = false;
      return;
    }
    if (prefill && !prefillAppliedRef.current) {
      setForm(prefill);
      prefillAppliedRef.current = true;
      return;
    }
    if (!prefill) {
      setForm(defaultFormState(receiptNumber));
    }
  }, [open, prefill, receiptNumber]);

  function updateLine(id: string, patch: Partial<ItemReceiptLine>) {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }));
  }

  function addLine() {
    setForm((prev) => ({ ...prev, lines: [...prev.lines, newLine()] }));
  }

  function duplicateLine(id: string) {
    const source = form.lines.find((l) => l.id === id);
    if (!source) return;
    setForm((prev) => ({
      ...prev,
      lines: [...prev.lines, { ...source, id: newLine().id }],
    }));
  }

  function removeLine(id: string) {
    setForm((prev) => {
      if (prev.lines.length <= 1) return prev;
      return { ...prev, lines: prev.lines.filter((l) => l.id !== id) };
    });
  }

  function handleAttachments(files: FileList | null) {
    if (!files?.length) return;
    const added = Array.from(files).map((f) => ({ name: f.name }));
    setAttachments((prev) => [...prev, ...added]);
    toast({
      title: "Files attached",
      description: `${added.length} file${added.length === 1 ? "" : "s"} attached.`,
    });
  }

  function handleAutofillFiles(files: FileList | null) {
    if (!files?.length) return;
    toast({
      title: "Autofill coming soon",
      description: "Document autofill will be available in a future update.",
    });
  }

  function handleNewProductServiceOpenChange(openState: boolean) {
    setNewProductServiceOpen(openState);
    if (!openState) setAddProductForLineId(null);
  }

  function handleProductServiceCreated(created: { name: string; sku?: string }) {
    if (addProductForLineId) {
      updateLine(addProductForLineId, {
        productService: created.name,
        sku: created.sku ?? "",
      });
    }
  }

  function validateForm() {
    if (!form.supplier.trim()) {
      toast({
        title: "Supplier required",
        description: "Choose a supplier for this item receipt.",
        variant: "destructive",
      });
      return false;
    }
    const hasLines = form.lines.some(
      (l) => l.productService.trim() && lineTotal(l) > 0,
    );
    if (!hasLines) {
      toast({
        title: "Items required",
        description: "Enter at least one product or service with qty received and rate.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  }

  function handleSave(closeAfter: boolean) {
    if (!validateForm()) return;
    onSave(form);
    if (closeAfter) {
      toast({
        title: "Item receipt recorded",
        description: `${form.supplier} — saved and closed.`,
      });
      onOpenChange(false);
      return;
    }
    const next = onSaveAndNew?.() ?? receiptNumber;
    setForm({
      ...defaultFormState(next),
      supplier: form.supplier,
      supplierId: form.supplierId,
    });
    setAttachments([]);
    toast({
      title: "Item receipt saved",
      description: `Starting item receipt ${next}.`,
    });
  }

  const subtotal = form.lines.reduce((sum, line) => sum + lineTotal(line), 0);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            "flex max-h-[98vh] flex-col gap-0 overflow-hidden p-0",
            "h-[min(900px,98vh)] w-[min(1280px,calc(100vw-2.5rem))] max-w-[min(1280px,calc(100vw-2.5rem))]",
            "[&>button]:hidden",
          )}
        >
          <DialogHeader className="relative shrink-0 flex-row items-center space-y-0 border-b pl-5 pr-3 py-2 min-h-[48px]">
            <DialogTitle className="text-lg font-semibold tracking-tight">
              Item receipt #{form.receiptNo || receiptNumber}
            </DialogTitle>
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-muted-foreground"
                onClick={() =>
                  toast({
                    title: "Feedback",
                    description: "Thanks — your feedback helps improve PetroBook.",
                  })
                }
              >
                <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                Give feedback
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                aria-label="Help"
                onClick={() =>
                  toast({
                    title: "Item receipt help",
                    description:
                      "Record inventory received from a supplier. Enter products, rates, and quantities received.",
                  })
                }
              >
                <HelpCircle className="h-4 w-4" />
              </Button>
              <DialogClose asChild>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 -mr-1" aria-label="Close">
                  <X className="h-4 w-4" />
                </Button>
              </DialogClose>
            </div>
          </DialogHeader>

          <div className="flex min-h-0 flex-1">
            <aside className="hidden w-[260px] shrink-0 flex-col border-r bg-muted/15 lg:flex">
              <div className="flex-1 overflow-y-auto p-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold">Autofill this item receipt</h2>
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px] uppercase">
                    Beta
                  </Badge>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Upload a document and we&apos;ll autofill your item receipt.
                </p>
                <input
                  ref={autofillInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  multiple
                  className="sr-only"
                  onChange={(e) => handleAutofillFiles(e.target.files)}
                />
                <div
                  className="mt-4 flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed bg-background px-4 py-6 text-center"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleAutofillFiles(e.dataTransfer.files);
                  }}
                >
                  <Upload className="h-8 w-8 text-muted-foreground/60" />
                  <p className="text-xs text-muted-foreground">
                    Drag documents here or click to upload
                  </p>
                  <p className="text-[11px] text-muted-foreground">PDF, PNG, JPEG</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => autofillInputRef.current?.click()}
                  >
                    Select files
                  </Button>
                </div>
                <p className="mt-4 text-[10px] leading-relaxed text-muted-foreground">
                  This feature uses generative AI, which can make mistakes. Review all suggestions
                  before saving.
                </p>
              </div>
            </aside>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Supplier" className="sm:col-span-1">
                    <SupplierSelect
                      value={form.supplier}
                      onValueChange={(name, id) =>
                        setForm((f) => ({ ...f, supplier: name, supplierId: id }))
                      }
                    />
                  </Field>
                  <Field label="Date">
                    <Input
                      className="h-10"
                      placeholder="MM/DD/YYYY"
                      value={form.date}
                      onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                    />
                  </Field>
                  <Field label="Receipt no.">
                    <Input
                      className="h-10"
                      value={form.receiptNo}
                      onChange={(e) => setForm((f) => ({ ...f, receiptNo: e.target.value }))}
                    />
                  </Field>
                </div>

                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                        <th className="w-8 px-2 py-2" />
                        <th className="w-8 px-2 py-2 font-medium">#</th>
                        <th className="min-w-[180px] px-2 py-2 font-medium">Product/service</th>
                        <th className="w-28 px-2 py-2 font-medium">SKU</th>
                        <th className={cn("min-w-7rem w-7rem", LINE_TABLE_CENTER_HEADER)}>Rate</th>
                        <th className={cn("min-w-7rem w-7rem", LINE_TABLE_CENTER_HEADER)}>
                          Qty received
                        </th>
                        <th className="w-20 px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {form.lines.map((line, index) => (
                        <tr key={line.id} className="border-b last:border-b-0">
                          <td className="px-2 py-1.5 text-muted-foreground/50">
                            <GripVertical className="h-4 w-4" />
                          </td>
                          <td className="px-2 py-1.5 text-muted-foreground tabular-nums">
                            {index + 1}
                          </td>
                          <td className={LINE_TABLE_CELL}>
                            <Select
                              open={productServiceSelectLineId === line.id}
                              onOpenChange={(openState) =>
                                setProductServiceSelectLineId(openState ? line.id : null)
                              }
                              value={line.productService || undefined}
                              onValueChange={(v) => {
                                if (v === ADD_PRODUCT_SERVICE_VALUE) {
                                  setProductServiceSelectLineId(null);
                                  setAddProductForLineId(line.id);
                                  setNewProductServiceOpen(true);
                                  return;
                                }
                                const product = productServices.find((p) => p.name === v);
                                updateLine(line.id, {
                                  productService: v,
                                  sku: product?.sku ?? line.sku,
                                });
                              }}
                            >
                              <SelectTrigger className={LINE_TABLE_SELECT}>
                                <SelectValue placeholder="Select product/service" />
                              </SelectTrigger>
                              <SelectContent className="max-h-[min(320px,var(--radix-select-content-available-height))] p-0">
                                <SelectItem
                                  value={ADD_PRODUCT_SERVICE_VALUE}
                                  className="rounded-none border-b border-border/60 bg-muted/40 py-2.5 pl-3 pr-8 text-primary font-medium focus:bg-muted/60 focus:text-primary"
                                >
                                  <span className="flex items-center gap-2">
                                    <Plus className="h-4 w-4 shrink-0" />
                                    Add new
                                  </span>
                                </SelectItem>
                                {productServices.map((p) => (
                                  <SelectItem
                                    key={p.id}
                                    value={p.name}
                                    className="py-2.5 pl-3 pr-8"
                                  >
                                    {p.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className={LINE_TABLE_CELL}>
                            <Input
                              className={LINE_TABLE_FIELD}
                              value={line.sku}
                              onChange={(e) => updateLine(line.id, { sku: e.target.value })}
                            />
                          </td>
                          <td className={LINE_TABLE_CENTER_CELL}>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              className={cn(LINE_TABLE_CENTER_FIELD, "w-full")}
                              value={line.rate || ""}
                              onChange={(e) =>
                                updateLine(line.id, {
                                  rate: Number.parseFloat(e.target.value) || 0,
                                })
                              }
                            />
                          </td>
                          <td className={LINE_TABLE_CENTER_CELL}>
                            <Input
                              type="number"
                              min="0"
                              step="any"
                              className={cn(LINE_TABLE_CENTER_FIELD, "w-full")}
                              value={line.qtyReceived || ""}
                              onChange={(e) =>
                                updateLine(line.id, {
                                  qtyReceived: Number.parseFloat(e.target.value) || 0,
                                })
                              }
                            />
                          </td>
                          <td className={LINE_TABLE_CELL}>
                            <div className="flex items-center justify-end gap-0.5">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                aria-label="Copy line"
                                onClick={() => duplicateLine(line.id)}
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                aria-label="Delete line"
                                disabled={form.lines.length <= 1}
                                onClick={() => removeLine(line.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <Button type="button" variant="outline" size="sm" onClick={addLine}>
                  <Plus className="h-4 w-4" />
                  Add lines
                </Button>

                {subtotal > 0 && (
                  <div className="flex justify-end border-t pt-3 text-sm">
                    <div className="text-right">
                      <p className="text-muted-foreground">Total</p>
                      <p className="text-lg font-semibold tabular-nums">
                        {new Intl.NumberFormat("en-PH", {
                          style: "currency",
                          currency: "PHP",
                        }).format(subtotal)}
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid gap-4 lg:grid-cols-2">
                  <Field label="Memo">
                    <Textarea
                      className="min-h-[120px] resize-y"
                      placeholder="Notes visible on reports"
                      value={form.memo}
                      onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
                    />
                  </Field>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Attachments</Label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="sr-only"
                      onChange={(e) => handleAttachments(e.target.files)}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleAttachments(e.dataTransfer.files);
                      }}
                      className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground transition-colors hover:bg-muted/40"
                    >
                      <Paperclip className="h-5 w-5" />
                      <span className="text-primary hover:underline">Add attachment</span>
                      <span className="text-xs">Max 20 MB per file</span>
                    </button>
                    {attachments.length > 0 && (
                      <ul className="space-y-1 text-xs text-muted-foreground">
                        {attachments.map((a) => (
                          <li key={a.name} className="truncate">
                            {a.name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              <div className="shrink-0 flex items-center justify-between gap-3 border-t bg-muted/20 px-6 py-3">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" onClick={() => handleSave(false)}>
                    Save
                  </Button>
                  <Button
                    type="button"
                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                    onClick={() => handleSave(true)}
                  >
                    Save and close
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ProductServiceCreateFlow
        open={newProductServiceOpen}
        onOpenChange={handleNewProductServiceOpenChange}
        onCreated={handleProductServiceCreated}
      />
    </>
  );
}
