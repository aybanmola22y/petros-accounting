"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, Package, Paintbrush, Shirt, X } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import {
  addProductService,
  getProductServicesSnapshot,
  type CreateProductServiceInput,
  type MockProductService,
  type ProductServiceItemType,
} from "@/lib/mock-data";
import {
  BundleProductFormSheet,
  bundleToCreateInput,
  defaultBundleForm,
} from "@/components/bundle-product-form-sheet";
import { cn } from "@/lib/utils";
import {
  defaultInventoryForm,
  InventoryProductFormSheet,
} from "@/components/inventory-product-form-sheet";
import {
  SellableProductFormDialog,
  defaultSellableForm,
  sellableToCreateInput,
} from "@/components/sellable-product-form-dialog";

const TYPE_META: Record<
  ProductServiceItemType,
  { title: string; description: string; icon: typeof Shirt }
> = {
  inventory: {
    title: "Inventory",
    description:
      "Products you buy and/or sell and that you track quantities of.",
    icon: Shirt,
  },
  "non-inventory": {
    title: "Non-inventory",
    description:
      "Products you buy and/or sell but don't need to (or can't) track quantities of, for example, nuts and bolts used in an installation.",
    icon: Package,
  },
  service: {
    title: "Service",
    description:
      "Services that you provide to customers, for example, landscaping or tax preparation services.",
    icon: Paintbrush,
  },
  bundle: {
    title: "Bundle",
    description:
      "A collection of products and/or services that you sell together, for example, a gift basket of fruit, cheese, and wine.",
    icon: Shirt,
  },
};

const TYPE_PICKER_ORDER: ProductServiceItemType[] = [
  "inventory",
  "non-inventory",
  "service",
  "bundle",
];

function BundleTypeIcon({ className }: { className?: string }) {
  return (
    <span className={cn("relative block size-6", className)}>
      <Shirt className="absolute left-0 top-0 size-4" strokeWidth={1.75} />
      <Shirt className="absolute bottom-0 right-0 size-4" strokeWidth={1.75} />
    </span>
  );
}

function TypePickerIcon({
  type,
}: {
  type: ProductServiceItemType;
}) {
  const Icon = TYPE_META[type].icon;
  return (
    <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
      {type === "bundle" ? (
        <BundleTypeIcon />
      ) : (
        <Icon className="size-6" strokeWidth={1.75} />
      )}
    </div>
  );
}

function TypePickerRow({
  type,
  onSelect,
}: {
  type: ProductServiceItemType;
  onSelect: () => void;
}) {
  const meta = TYPE_META[type];
  return (
    <button
      type="button"
      onClick={onSelect}
      className="grid w-full grid-cols-[3rem_1fr] items-center gap-x-4 border-b px-5 py-5 text-left transition-colors hover:bg-muted/50 last:border-b-0"
    >
      <TypePickerIcon type={type} />
      <div className="min-w-0 space-y-1.5">
        <p className="text-[15px] font-semibold leading-tight text-foreground">
          {meta.title}
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {meta.description}
        </p>
      </div>
    </button>
  );
}

type ProductServiceCreateFlowProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (product: MockProductService) => void;
};

export function ProductServiceCreateFlow({
  open,
  onOpenChange,
  onCreated,
}: ProductServiceCreateFlowProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<"type" | "form">("type");
  const [itemType, setItemType] = useState<ProductServiceItemType | null>(null);
  const [inventory, setInventory] = useState(defaultInventoryForm);
  const [nonInventory, setNonInventory] = useState(defaultSellableForm);
  const [service, setService] = useState(defaultSellableForm);
  const [bundle, setBundle] = useState(defaultBundleForm);

  function reset() {
    setStep("type");
    setItemType(null);
    setInventory(defaultInventoryForm());
    setNonInventory(defaultSellableForm());
    setService(defaultSellableForm());
    setBundle(defaultBundleForm());
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) reset();
  }

  useEffect(() => {
    if (!open) reset();
  }, [open]);

  function selectType(type: ProductServiceItemType) {
    setItemType(type);
    setStep("form");
  }

  function buildInput(): CreateProductServiceInput | null {
    if (!itemType) return null;

    if (itemType === "inventory") {
      const name = inventory.name.trim();
      if (!name) {
        toast({
          title: "Name required",
          description: "Enter a product or service name.",
          variant: "destructive",
        });
        return null;
      }
      const qty = inventory.initialQty.trim();
      if (!qty || Number.isNaN(Number(qty))) {
        toast({
          title: "Initial quantity required",
          description: "Enter the initial quantity on hand.",
          variant: "destructive",
        });
        return null;
      }
      if (!inventory.asOfDate.trim()) {
        toast({
          title: "As of date required",
          description: "Choose the as of date for inventory.",
          variant: "destructive",
        });
        return null;
      }
      return {
        name,
        itemType,
        sku: inventory.sku,
        category: inventory.category || undefined,
        className: inventory.className || undefined,
        initialQty: Number(qty),
        asOfDate: inventory.asOfDate,
        reorderPoint: inventory.reorderPoint
          ? Number(inventory.reorderPoint)
          : undefined,
        inventoryAssetAccount: inventory.inventoryAssetAccount,
        salesDescription: inventory.salesDescription,
        salesPrice: inventory.salesPrice ? Number(inventory.salesPrice) : undefined,
        incomeAccount: inventory.incomeAccount,
        salesTaxInclusive: inventory.salesTaxInclusive,
        purchaseDescription: inventory.purchaseDescription,
        cost: inventory.cost ? Number(inventory.cost) : undefined,
        expenseAccount: inventory.expenseAccount,
        purchaseTaxInclusive: inventory.purchaseTaxInclusive,
        preferredSupplier: inventory.preferredSupplier || undefined,
      };
    }

    if (itemType === "bundle") {
      const input = bundleToCreateInput(bundle, getProductServicesSnapshot());
      if (!input) {
        toast({
          title: "Name required",
          description: "Enter a product or service name.",
          variant: "destructive",
        });
        return null;
      }
      if (!input.bundleLines?.length) {
        toast({
          title: "Bundle items required",
          description: "Add at least one product or service with a quantity.",
          variant: "destructive",
        });
        return null;
      }
      return input;
    }

    if (itemType === "non-inventory" || itemType === "service") {
      const form = itemType === "non-inventory" ? nonInventory : service;
      const input = sellableToCreateInput(form, itemType);
      if (!input) {
        toast({
          title: "Name required",
          description: "Enter a product or service name.",
          variant: "destructive",
        });
      }
      return input;
    }

    return null;
  }

  function save() {
    const input = buildInput();
    if (!input) return;
    const created = addProductService(input);
    if (!created) {
      toast({
        title: "Already exists",
        description: `"${input.name}" is already in the list.`,
        variant: "destructive",
      });
      return;
    }
    onCreated(created);
    handleOpenChange(false);
    toast({
      title: "Product/service added",
      description: `${created.name} is ready to use.`,
    });
  }

  const typeSheet = (
    <Sheet open={open && step === "type"} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[440px] [&>button]:hidden"
      >
        <SheetTitle className="sr-only">Product/Service information</SheetTitle>
        <div className="flex items-center justify-between border-b px-5 py-4">
          <p className="text-lg font-semibold">Product/Service information</p>
          <button
            type="button"
            className="rounded-sm p-1 text-muted-foreground hover:text-foreground"
            onClick={() => handleOpenChange(false)}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {TYPE_PICKER_ORDER.map((type) => (
            <TypePickerRow
              key={type}
              type={type}
              onSelect={() => selectType(type)}
            />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );

  if (!itemType) {
    return typeSheet;
  }

  const meta = TYPE_META[itemType];
  const TypeIcon = meta.icon;
  const typeIcon =
    itemType === "bundle" ? (
      <BundleTypeIcon />
    ) : (
      <TypeIcon className="h-5 w-5" strokeWidth={1.75} />
    );

  if (itemType === "inventory") {
    return (
      <>
        {typeSheet}
        <InventoryProductFormSheet
          open={open && step === "form"}
          onOpenChange={handleOpenChange}
          form={inventory}
          setForm={setInventory}
          typeIcon={typeIcon}
          typeTitle={meta.title}
          onChangeType={() => setStep("type")}
          onSave={save}
        />
      </>
    );
  }

  if (itemType === "bundle") {
    return (
      <>
        {typeSheet}
        <BundleProductFormSheet
          open={open && step === "form"}
          onOpenChange={handleOpenChange}
          form={bundle}
          setForm={setBundle}
          typeIcon={typeIcon}
          typeTitle={meta.title}
          onChangeType={() => setStep("type")}
          onSave={save}
        />
      </>
    );
  }

  if (itemType === "non-inventory" || itemType === "service") {
    const sellableForm = itemType === "non-inventory" ? nonInventory : service;
    const setSellableForm =
      itemType === "non-inventory" ? setNonInventory : setService;
    return (
      <>
        {typeSheet}
        <SellableProductFormDialog
          open={open && step === "form"}
          onOpenChange={handleOpenChange}
          form={sellableForm}
          setForm={setSellableForm}
          typeTitle={meta.title}
          typeIcon={typeIcon}
          onChangeType={() => setStep("type")}
          onSave={save}
        />
      </>
    );
  }

  return null;
}
