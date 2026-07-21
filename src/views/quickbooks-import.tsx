"use client";

import { useState, useSyncExternalStore, type ComponentType } from "react";
import {
  BookOpenText,
  ChevronDown,
  FileText,
  Landmark,
  ListTree,
  MapPin,
  Package,
  PieChart,
  Receipt,
  RefreshCw,
  Tags,
  TrendingUp,
  Truck,
  Upload,
  Users,
} from "lucide-react";
import { SupabaseConnectionStatus } from "@/components/supabase-connection-status";
import { ImportArAgingLocationsDialog } from "@/components/import-ar-aging-locations-dialog";
import { ImportApAgingDetailDialog } from "@/components/import-ap-aging-detail-dialog";
import { ImportExpensesBySupplierSummaryDialog } from "@/components/import-expenses-by-supplier-summary-dialog";
import { ImportProfitLossDialog } from "@/components/import-profit-loss-dialog";
import { ImportBalanceSheetDialog } from "@/components/import-balance-sheet-dialog";
import { ImportCustomersDialog } from "@/components/import-customers-dialog";
import { ImportChartOfAccountsDialog } from "@/components/import-chart-of-accounts-dialog";
import { ImportGeneralLedgerDialog } from "@/components/import-general-ledger-dialog";
import { ImportExpensesDialog } from "@/components/import-expenses-dialog";
import { ImportSalesTransactionsDialog } from "@/components/import-sales-transactions-dialog";
import { ImportSalesTransactionLinesDialog } from "@/components/import-sales-transaction-lines-dialog";
import { ImportProductServicesDialog } from "@/components/import-product-services-dialog";
import { ImportSuppliersDialog } from "@/components/import-suppliers-dialog";
import { ImportUnpaidBillsDialog } from "@/components/import-unpaid-bills-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  getStoreDataSummarySnapshot,
  resetMockStore,
  subscribeMockStore,
  type StoreDataSummary,
} from "@/lib/mock-data";

const EMPTY_STORE_SUMMARY: StoreDataSummary = {
  chartAccounts: 0,
  customers: 0,
  suppliers: 0,
  invoices: 0,
  expenses: 0,
  salesTransactions: 0,
  products: 0,
};

function useStoreSummary() {
  return useSyncExternalStore(
    subscribeMockStore,
    getStoreDataSummarySnapshot,
    () => EMPTY_STORE_SUMMARY,
  );
}

type ImportItem = {
  id: string;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  qboSteps: string[];
  onImport: () => void;
  count?: number;
};

function ImportRow({ item }: { item: ImportItem }) {
  const Icon = item.icon;

  return (
    <div className="group flex flex-col gap-3 bg-white px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6 sm:px-5">
      <div className="flex min-w-0 flex-1 gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
            {typeof item.count === "number" ? (
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                {item.count.toLocaleString()} loaded
              </span>
            ) : null}
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {item.description}
          </p>
          <Collapsible>
            <CollapsibleTrigger className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground [&[data-state=open]>svg]:rotate-180">
              How to export from QuickBooks
              <ChevronDown className="h-3.5 w-3.5 transition-transform" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs leading-relaxed text-muted-foreground">
                {item.qboSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={item.onImport}
        className="h-9 shrink-0 gap-2 self-start"
      >
        <Upload className="h-3.5 w-3.5" />
        Import
      </Button>
    </div>
  );
}

function ImportSection({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: ImportItem[];
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border/80 bg-white">
      <div className="border-b border-border/70 bg-muted/30 px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="grid gap-px bg-border/70 xl:grid-cols-2">
        {items.map((item) => (
          <ImportRow key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}

export function QuickBooksImport() {
  const { toast } = useToast();
  const summary = useStoreSummary();
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [coaDialogOpen, setCoaDialogOpen] = useState(false);
  const [expensesDialogOpen, setExpensesDialogOpen] = useState(false);
  const [unpaidBillsDialogOpen, setUnpaidBillsDialogOpen] = useState(false);
  const [salesDialogOpen, setSalesDialogOpen] = useState(false);
  const [salesLinesDialogOpen, setSalesLinesDialogOpen] = useState(false);
  const [productServicesDialogOpen, setProductServicesDialogOpen] = useState(false);
  const [arAgingLocationsDialogOpen, setArAgingLocationsDialogOpen] = useState(false);
  const [apAgingDetailDialogOpen, setApAgingDetailDialogOpen] = useState(false);
  const [expensesBySupplierDialogOpen, setExpensesBySupplierDialogOpen] = useState(false);
  const [profitLossDialogOpen, setProfitLossDialogOpen] = useState(false);
  const [balanceSheetDialogOpen, setBalanceSheetDialogOpen] = useState(false);
  const [generalLedgerDialogOpen, setGeneralLedgerDialogOpen] = useState(false);
  const [replaceCoa, setReplaceCoa] = useState(true);
  const [replaceExpenses, setReplaceExpenses] = useState(true);
  const [replaceCustomers, setReplaceCustomers] = useState(true);
  const [replaceSuppliers, setReplaceSuppliers] = useState(true);
  const [replaceUnpaidBills, setReplaceUnpaidBills] = useState(true);
  const [replaceSales, setReplaceSales] = useState(true);
  const [replaceProductServices, setReplaceProductServices] = useState(true);

  function handleReset() {
    const confirmed = window.confirm(
      "Clear all imported data? This removes everything from this browser and cannot be undone.",
    );
    if (!confirmed) return;
    resetMockStore();
    toast({ title: "Data cleared", description: "Ready for a fresh QuickBooks import." });
  }

  const hasData = Object.values(summary).some((count) => count > 0);

  const replaceOptions = [
    { id: "replace-coa", label: "Chart of accounts", checked: replaceCoa, onChange: setReplaceCoa },
    { id: "replace-expenses", label: "Expenses", checked: replaceExpenses, onChange: setReplaceExpenses },
    { id: "replace-sales", label: "Sales transactions", checked: replaceSales, onChange: setReplaceSales },
    {
      id: "replace-product-services",
      label: "Products & services",
      checked: replaceProductServices,
      onChange: setReplaceProductServices,
    },
    { id: "replace-customers", label: "Customers", checked: replaceCustomers, onChange: setReplaceCustomers },
    { id: "replace-suppliers", label: "Suppliers", checked: replaceSuppliers, onChange: setReplaceSuppliers },
    {
      id: "replace-unpaid-bills",
      label: "Unpaid bills",
      checked: replaceUnpaidBills,
      onChange: setReplaceUnpaidBills,
    },
  ] as const;

  const summaryStats = [
    { label: "Accounts", value: summary.chartAccounts },
    { label: "Expenses", value: summary.expenses },
    { label: "Sales", value: summary.salesTransactions },
    { label: "Products", value: summary.products },
    { label: "Customers", value: summary.customers },
    { label: "Suppliers", value: summary.suppliers },
  ];

  const foundationItems: ImportItem[] = [
    {
      id: "coa",
      title: "Chart of Accounts",
      description: "Account names, types, and balances from the Account List report.",
      icon: ListTree,
      count: summary.chartAccounts,
      qboSteps: [
        "In QuickBooks: Reports → Account List",
        "Click Export (Excel) — includes Total balance for every account",
        "Import that file here to update QuickBooks balances",
        "Optional: Chart of accounts list export adds Bank Balance for connected banks",
      ],
      onImport: () => setCoaDialogOpen(true),
    },
    {
      id: "products",
      title: "Products and Services",
      description: "Catalog names, types, prices, and inventory quantities.",
      icon: Tags,
      count: summary.products,
      qboSteps: [
        "In QuickBooks: Sales → Products and services",
        "Export the full list to Excel",
        "Import here — category headers and Service/Inventory types are preserved",
      ],
      onImport: () => setProductServicesDialogOpen(true),
    },
  ];

  const transactionItems: ImportItem[] = [
    {
      id: "expenses",
      title: "Expenses",
      description: "Expense, bill, and bill payment transactions.",
      icon: Receipt,
      count: summary.expenses,
      qboSteps: [
        "In QuickBooks: Expenses → Expenses",
        "Export the expenses list to Excel",
        "Import Expenses.xls here",
      ],
      onImport: () => setExpensesDialogOpen(true),
    },
    {
      id: "sales",
      title: "Sales Transactions",
      description: "Invoices, payments, estimates, and other sales activity.",
      icon: TrendingUp,
      count: summary.salesTransactions,
      qboSteps: [
        "In QuickBooks: Sales → All sales (or export sales.xls)",
        "Export the full transaction list to Excel",
        "Import here — columns match the export 1:1",
      ],
      onImport: () => setSalesDialogOpen(true),
    },
    {
      id: "sales-lines",
      title: "Invoice Line Items",
      description: "Per-line product, description, quantity, and rate for each invoice.",
      icon: Package,
      qboSteps: [
        "In QuickBooks: Reports → Sales by Product/Service Detail",
        "Set Report period to All Dates and Run report",
        "Export to Excel and import here (matched to invoices by number)",
      ],
      onImport: () => setSalesLinesDialogOpen(true),
    },
    {
      id: "unpaid-bills",
      title: "Unpaid Bills",
      description: "Open bills with supplier, due date, amounts, and status.",
      icon: FileText,
      qboSteps: [
        "In QuickBooks: Expenses → Bills (Unpaid Bills report)",
        "Export to Excel (Unpaid Bills.xls)",
        "Import here — columns match the export 1:1",
      ],
      onImport: () => setUnpaidBillsDialogOpen(true),
    },
  ];

  const reportItems: ImportItem[] = [
    {
      id: "pnl",
      title: "Profit and Loss",
      description: "Account breakdown for Standard Reports. Re-import only to refresh from QuickBooks.",
      icon: PieChart,
      qboSteps: [
        "In QuickBooks: Reports → Business overview → Profit and Loss",
        "Set Report period to This year to date (or the same From/To as this app), Accrual",
        "Confirm the year matches, Export to Excel, import here",
      ],
      onImport: () => setProfitLossDialogOpen(true),
    },
    {
      id: "balance-sheet",
      title: "Balance Sheet",
      description: "Balance Sheet report layout and totals. Separate from Chart of Accounts.",
      icon: Landmark,
      qboSteps: [
        "In QuickBooks: Reports → Business overview → Balance Sheet",
        "Set report period to All Dates and accounting method to Accrual",
        "Export to Excel and import here",
      ],
      onImport: () => setBalanceSheetDialogOpen(true),
    },
    {
      id: "gl",
      title: "Account History (General Ledger)",
      description: "Per-account transaction history for Account History registers.",
      icon: BookOpenText,
      qboSteps: [
        "In QuickBooks: Reports → General Ledger (or Transaction Detail by Account)",
        "Set Report period to All Dates and method to Accrual",
        "Run report → Export to Excel and import here",
      ],
      onImport: () => setGeneralLedgerDialogOpen(true),
    },
    {
      id: "ar-aging",
      title: "AR Ageing Report",
      description: "Summary or Detail export — Summary for A/R Aging, Detail for Sales Performance.",
      icon: MapPin,
      qboSteps: [
        "Summary: Reports → Who owes you → A/R Ageing Summary → Export to Excel",
        "Detail: Reports → Who owes you → A/R Ageing Detail → Export to Excel",
        "Import either file here — the app detects which report it is",
      ],
      onImport: () => setArAgingLocationsDialogOpen(true),
    },
    {
      id: "ap-aging",
      title: "AP Ageing Detail",
      description: "Open payables detail for Expenses Performance.",
      icon: Receipt,
      qboSteps: [
        "In QuickBooks: Reports → What you owe → A/P Ageing Detail",
        "Set as of date (e.g. Today), then Export to Excel",
        "Import here for Expenses Performance A/P Ageing Detail",
      ],
      onImport: () => setApAgingDetailDialogOpen(true),
    },
    {
      id: "expenses-by-supplier",
      title: "Expenses by Supplier Summary",
      description: "Supplier expense totals for Expenses Performance.",
      icon: PieChart,
      qboSteps: [
        "In QuickBooks: Reports → Expenses and suppliers → Expenses by Supplier Summary",
        "Set Report period + Accrual (same as the management report)",
        "Export to Excel and import here",
      ],
      onImport: () => setExpensesBySupplierDialogOpen(true),
    },
  ];

  const contactItems: ImportItem[] = [
    {
      id: "customers",
      title: "Customers",
      description: "Customer contacts, addresses, and open balances.",
      icon: Users,
      count: summary.customers,
      qboSteps: [
        "In QuickBooks: Sales & Get Paid → Customers & leads → Customers",
        "Export to Excel (Customers.xls)",
        "Import here — columns match the export 1:1",
      ],
      onImport: () => setCustomerDialogOpen(true),
    },
    {
      id: "suppliers",
      title: "Suppliers / Vendors",
      description: "Vendor contacts and open balances.",
      icon: Truck,
      count: summary.suppliers,
      qboSteps: [
        "In QuickBooks: Expenses → Suppliers",
        "Export supplier list to Excel (Suppliers.xls)",
        "Import here — columns match the export 1:1",
      ],
      onImport: () => setSupplierDialogOpen(true),
    },
  ];

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">Import from QuickBooks</h2>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Export Excel or CSV from QuickBooks Online, then import here. Data is saved to Supabase.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 shrink-0 gap-2 text-muted-foreground hover:text-foreground"
          onClick={handleReset}
          disabled={!hasData}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Clear all data
        </Button>
      </div>

      <SupabaseConnectionStatus />

      <div className="rounded-xl border border-border/80 bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Loaded data</p>
            <p className="text-xs text-muted-foreground">Counts currently available in this workspace</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-border/70 bg-border/70 sm:grid-cols-6">
          {summaryStats.map((stat) => (
            <div key={stat.label} className="bg-white px-3 py-3 text-center">
              <p className="text-lg font-semibold tabular-nums tracking-tight">{stat.value}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border/80 bg-white p-4">
        <div className="mb-3">
          <p className="text-sm font-semibold">Import preferences</p>
          <p className="text-xs text-muted-foreground">
            Recommended order: Chart of Accounts → Expenses → Sales → Customers → Suppliers & Bills.
            Checked items replace existing records on import.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {replaceOptions.map((option) => (
            <label
              key={option.id}
              htmlFor={option.id}
              className={cn(
                "flex cursor-pointer items-center gap-2.5 rounded-lg border border-border/70 px-3 py-2.5",
                "transition-colors hover:bg-muted/40",
              )}
            >
              <Checkbox
                id={option.id}
                checked={option.checked}
                onCheckedChange={(checked) => option.onChange(checked === true)}
              />
              <span className="text-sm">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <ImportSection
          title="1. Foundation"
          subtitle="Start here so later imports can match accounts and products."
          items={foundationItems}
        />
        <ImportSection
          title="2. Transactions"
          subtitle="Bring in day-to-day expense and sales activity."
          items={transactionItems}
        />
        <ImportSection
          title="3. Reports"
          subtitle="Optional report snapshots for dashboards and standard reports."
          items={reportItems}
        />
        <ImportSection
          title="4. Contacts"
          subtitle="Customer and supplier lists with open balances."
          items={contactItems}
        />
      </div>

      <ImportChartOfAccountsDialog
        open={coaDialogOpen}
        onOpenChange={setCoaDialogOpen}
        replaceExisting={replaceCoa}
      />

      <ImportExpensesDialog
        open={expensesDialogOpen}
        onOpenChange={setExpensesDialogOpen}
        replaceExisting={replaceExpenses}
        onImported={(result) => {
          toast({
            title: "Expenses imported",
            description: `${result.added} added${
              result.unmatchedCategories
                ? ` · ${result.unmatchedCategories} categories not in chart of accounts`
                : ""
            }`,
          });
        }}
      />

      <ImportSalesTransactionsDialog
        open={salesDialogOpen}
        onOpenChange={setSalesDialogOpen}
        replaceExisting={replaceSales}
        onImported={(result) => {
          toast({
            title: "Sales transactions imported",
            description: `${result.added.toLocaleString()} imported${result.skipped.length ? ` · ${result.skipped.length} skipped` : ""}.`,
          });
        }}
      />

      <ImportSalesTransactionLinesDialog
        open={salesLinesDialogOpen}
        onOpenChange={setSalesLinesDialogOpen}
        onImported={(result) => {
          toast({
            title: "Invoice line items imported",
            description: `${result.inserted.toLocaleString()} lines across ${result.invoiceCount.toLocaleString()} invoices.`,
          });
        }}
      />

      <ImportProfitLossDialog
        open={profitLossDialogOpen}
        onOpenChange={setProfitLossDialogOpen}
      />

      <ImportBalanceSheetDialog
        open={balanceSheetDialogOpen}
        onOpenChange={setBalanceSheetDialogOpen}
      />

      <ImportGeneralLedgerDialog
        open={generalLedgerDialogOpen}
        onOpenChange={setGeneralLedgerDialogOpen}
      />

      <ImportArAgingLocationsDialog
        open={arAgingLocationsDialogOpen}
        onOpenChange={setArAgingLocationsDialogOpen}
      />

      <ImportApAgingDetailDialog
        open={apAgingDetailDialogOpen}
        onOpenChange={setApAgingDetailDialogOpen}
      />

      <ImportExpensesBySupplierSummaryDialog
        open={expensesBySupplierDialogOpen}
        onOpenChange={setExpensesBySupplierDialogOpen}
      />

      <ImportUnpaidBillsDialog
        open={unpaidBillsDialogOpen}
        onOpenChange={setUnpaidBillsDialogOpen}
        replaceExisting={replaceUnpaidBills}
        onImported={(result) => {
          toast({
            title: "Unpaid bills imported",
            description: `${result.added.length} imported${result.skipped.length ? ` · ${result.skipped.length} skipped` : ""}.`,
          });
        }}
      />

      <ImportCustomersDialog
        open={customerDialogOpen}
        onOpenChange={setCustomerDialogOpen}
        replaceExisting={replaceCustomers}
        onImported={(result) => {
          toast({
            title: "Customers imported",
            description: `${result.added.length.toLocaleString()} added${result.skipped.length ? ` · ${result.skipped.length} skipped` : ""}.`,
          });
        }}
      />

      <ImportProductServicesDialog
        open={productServicesDialogOpen}
        onOpenChange={setProductServicesDialogOpen}
        replaceExisting={replaceProductServices}
        onImported={(result) => {
          toast({
            title: "Products and services imported",
            description: `${result.added.length} added${result.skipped.length ? ` · ${result.skipped.length} skipped` : ""}.`,
          });
        }}
      />

      <ImportSuppliersDialog
        open={supplierDialogOpen}
        onOpenChange={setSupplierDialogOpen}
        replaceExisting={replaceSuppliers}
        onImported={(result) => {
          toast({
            title: "Suppliers imported",
            description: `${result.added.length} added${result.skipped.length ? ` · ${result.skipped.length} skipped` : ""}.`,
          });
        }}
      />
    </div>
  );
}
