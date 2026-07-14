"use client";

import { useState, useSyncExternalStore } from "react";
import {
  AlertTriangle,
  FileSpreadsheet,
  Receipt,
  RefreshCw,
  Upload,
  Users,
  ListTree,
  Truck,
  FileText,
  TrendingUp,
  MapPin,
  PieChart,
  Landmark,
  BookOpenText,
  Package,
  Tags,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
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

function ImportCard({
  title,
  description,
  icon: Icon,
  qboSteps,
  onImport,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  qboSteps: string[];
  onImport: () => void;
}) {
  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="list-decimal space-y-1 pl-4 text-sm text-muted-foreground">
          {qboSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <Button type="button" onClick={onImport} className="gap-2">
          <Upload className="h-4 w-4" />
          Choose file to import
        </Button>
      </CardContent>
    </Card>
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

  return (
    <div className="space-y-6 w-full max-w-5xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Accounting
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Import from QuickBooks</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Export lists from QuickBooks Online as Excel or CSV, then import them here. Chart of
            accounts, expenses, sales transactions, products and services, customers, suppliers, and unpaid bills are saved to Supabase.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="gap-2 shrink-0"
          onClick={handleReset}
          disabled={!hasData}
        >
          <RefreshCw className="h-4 w-4" />
          Clear all data
        </Button>
      </div>

      <SupabaseConnectionStatus />

      <Card className="rounded-xl border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
            Current data in this browser
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-sm">
            <div>
              <p className="text-2xl font-semibold tabular-nums">{summary.chartAccounts}</p>
              <p className="text-muted-foreground">Accounts</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">{summary.expenses}</p>
              <p className="text-muted-foreground">Expenses</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">{summary.salesTransactions}</p>
              <p className="text-muted-foreground">Sales</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">{summary.suppliers}</p>
              <p className="text-muted-foreground">Suppliers</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">{summary.customers}</p>
              <p className="text-muted-foreground">Customers</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">{summary.products}</p>
              <p className="text-muted-foreground">Products</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">Recommended order:</span> Chart of Accounts
          first, then Expenses, then Sales Transactions, then Customers, then Suppliers and Unpaid Bills.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-lg border px-4 py-3">
          <Checkbox
            id="replace-coa"
            checked={replaceCoa}
            onCheckedChange={(checked) => setReplaceCoa(checked === true)}
          />
          <Label htmlFor="replace-coa" className="text-sm font-normal cursor-pointer">
            Replace existing chart of accounts on import (recommended for first import)
          </Label>
        </div>
        <div className="flex items-center gap-2 rounded-lg border px-4 py-3">
          <Checkbox
            id="replace-expenses"
            checked={replaceExpenses}
            onCheckedChange={(checked) => setReplaceExpenses(checked === true)}
          />
          <Label htmlFor="replace-expenses" className="text-sm font-normal cursor-pointer">
            Replace existing expenses on import (recommended for first import)
          </Label>
        </div>
        <div className="flex items-center gap-2 rounded-lg border px-4 py-3">
          <Checkbox
            id="replace-customers"
            checked={replaceCustomers}
            onCheckedChange={(checked) => setReplaceCustomers(checked === true)}
          />
          <Label htmlFor="replace-customers" className="text-sm font-normal cursor-pointer">
            Replace existing customers on import (recommended for first import)
          </Label>
        </div>
        <div className="flex items-center gap-2 rounded-lg border px-4 py-3">
          <Checkbox
            id="replace-suppliers"
            checked={replaceSuppliers}
            onCheckedChange={(checked) => setReplaceSuppliers(checked === true)}
          />
          <Label htmlFor="replace-suppliers" className="text-sm font-normal cursor-pointer">
            Replace existing suppliers on import (recommended for first import)
          </Label>
        </div>
        <div className="flex items-center gap-2 rounded-lg border px-4 py-3">
          <Checkbox
            id="replace-sales"
            checked={replaceSales}
            onCheckedChange={(checked) => setReplaceSales(checked === true)}
          />
          <Label htmlFor="replace-sales" className="text-sm font-normal cursor-pointer">
            Replace existing sales transactions on import (recommended for first import)
          </Label>
        </div>
        <div className="flex items-center gap-2 rounded-lg border px-4 py-3">
          <Checkbox
            id="replace-product-services"
            checked={replaceProductServices}
            onCheckedChange={(checked) => setReplaceProductServices(checked === true)}
          />
          <Label htmlFor="replace-product-services" className="text-sm font-normal cursor-pointer">
            Replace existing products and services on import (recommended for first import)
          </Label>
        </div>
        <div className="flex items-center gap-2 rounded-lg border px-4 py-3">
          <Checkbox
            id="replace-unpaid-bills"
            checked={replaceUnpaidBills}
            onCheckedChange={(checked) => setReplaceUnpaidBills(checked === true)}
          />
          <Label htmlFor="replace-unpaid-bills" className="text-sm font-normal cursor-pointer">
            Replace existing unpaid bills on import (recommended for first import)
          </Label>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ImportCard
          title="Chart of Accounts"
          description="Account names, types, and balances from QuickBooks. Best source: Account List report (Total balance column)."
          icon={ListTree}
          qboSteps={[
            "In QuickBooks: Reports → Account List",
            "Click Export (Excel) — includes Total balance for every account",
            "Import that file here to update QuickBooks balances",
            "Optional: Chart of accounts list export adds Bank Balance for connected banks",
          ]}
          onImport={() => setCoaDialogOpen(true)}
        />
        <ImportCard
          title="Expenses"
          description="Expense, bill, and bill payment transactions from QuickBooks."
          icon={Receipt}
          qboSteps={[
            "In QuickBooks: Expenses → Expenses",
            "Export the expenses list to Excel",
            "Import Expenses.xls here",
          ]}
          onImport={() => setExpensesDialogOpen(true)}
        />
        <ImportCard
          title="Sales Transactions"
          description="Invoices, payments, estimates, and other sales activity from QuickBooks."
          icon={TrendingUp}
          qboSteps={[
            "In QuickBooks: Sales → All sales (or export sales.xls)",
            "Export the full transaction list to Excel",
            "Import here — columns match the export 1:1",
          ]}
          onImport={() => setSalesDialogOpen(true)}
        />
        <ImportCard
          title="Products and Services"
          description="Your sellable catalog from QuickBooks — names, types, prices, and inventory quantities for the Products & Services page."
          icon={Tags}
          qboSteps={[
            "In QuickBooks: Sales → Products and services",
            "Export the full list to Excel",
            "Import here — category headers and Service/Inventory types are preserved",
          ]}
          onImport={() => setProductServicesDialogOpen(true)}
        />
        <ImportCard
          title="Invoice Line Items"
          description="Per-line Product/Service, description, quantity, and rate for each invoice — fills the View/Edit invoice lines so they match QuickBooks exactly."
          icon={Package}
          qboSteps={[
            "In QuickBooks: Reports → Sales by Product/Service Detail",
            "Set Report period to All Dates and Run report",
            "Export to Excel and import here (matched to invoices by number)",
          ]}
          onImport={() => setSalesLinesDialogOpen(true)}
        />
        <ImportCard
          title="Profit and Loss"
          description="Import once from QuickBooks for the correct account breakdown. New sales and expenses in the app update the report automatically — re-import only to refresh from QuickBooks."
          icon={PieChart}
          qboSteps={[
            "In QuickBooks: Reports → Business overview → Profit and Loss",
            "Set Report period to This year to date (or the same From/To as this app), Accrual",
            "Confirm the year matches (e.g. 01/01/2026 – 07/13/2026), Export to Excel, import here",
          ]}
          onImport={() => setProfitLossDialogOpen(true)}
        />
        <ImportCard
          title="Balance Sheet"
          description="Separate from Chart of Accounts — import the Balance Sheet report for Standard Reports layout and totals. All Dates + Accrual. New transactions update automatically."
          icon={Landmark}
          qboSteps={[
            "In QuickBooks: Reports → Business overview → Balance Sheet",
            "Set report period to All Dates and accounting method to Accrual",
            "Export to Excel and import here (not the Chart of accounts Run report)",
          ]}
          onImport={() => setBalanceSheetDialogOpen(true)}
        />
        <ImportCard
          title="Account History (General Ledger)"
          description="Real per-account transaction history (the register shown when you click Account history). Makes every account match QuickBooks exactly — BPI, Cash on hand, and all others."
          icon={BookOpenText}
          qboSteps={[
            "In QuickBooks: Reports → General Ledger (or Transaction Detail by Account)",
            "Set Report period to All Dates and method to Accrual",
            "Run report → Export to Excel and import here",
          ]}
          onImport={() => setGeneralLedgerDialogOpen(true)}
        />
        <ImportCard
          title="AR Ageing Report"
          description="Summary or Detail export from QuickBooks — Summary for A/R Aging, Detail for Sales Performance."
          icon={MapPin}
          qboSteps={[
            "Summary: Reports → Who owes you → A/R Ageing Summary → Export to Excel",
            "Detail: Reports → Who owes you → A/R Ageing Detail → Export to Excel",
            "Import either file here — the app detects which report it is",
          ]}
          onImport={() => setArAgingLocationsDialogOpen(true)}
        />
        <ImportCard
          title="AP Ageing Detail"
          description="A/P Ageing Detail from QuickBooks — matches Expenses Performance (No., Location, Past Due, totals)."
          icon={Receipt}
          qboSteps={[
            "In QuickBooks: Reports → What you owe → A/P Ageing Detail",
            "Set as of date (e.g. Today), then Export to Excel",
            "Import here for Expenses Performance A/P Ageing Detail",
          ]}
          onImport={() => setApAgingDetailDialogOpen(true)}
        />
        <ImportCard
          title="Expenses by Supplier Summary"
          description="Supplier expense totals from QuickBooks — matches Expenses Performance TOTAL (e.g. ₱3,048,146.76)."
          icon={PieChart}
          qboSteps={[
            "In QuickBooks: Reports → Expenses and suppliers → Expenses by Supplier Summary",
            "Set Report period + Accrual (same as the management report)",
            "Export to Excel and import here",
          ]}
          onImport={() => setExpensesBySupplierDialogOpen(true)}
        />
        <ImportCard
          title="Unpaid Bills"
          description="Open bills from QuickBooks — supplier, due date, amounts, and status."
          icon={FileText}
          qboSteps={[
            "In QuickBooks: Expenses → Bills (Unpaid Bills report)",
            "Export to Excel (Unpaid Bills.xls)",
            "Import here — columns match the export 1:1",
          ]}
          onImport={() => setUnpaidBillsDialogOpen(true)}
        />
        <ImportCard
          title="Customers"
          description="Customer contact list with addresses and open balances."
          icon={Users}
          qboSteps={[
            "In QuickBooks: Sales & Get Paid → Customers & leads → Customers",
            "Export to Excel (Customers.xls)",
            "Import here — columns match the export 1:1",
          ]}
          onImport={() => setCustomerDialogOpen(true)}
        />
        <ImportCard
          title="Suppliers / Vendors"
          description="Vendor list with contact details and open balances."
          icon={Truck}
          qboSteps={[
            "In QuickBooks: Expenses → Suppliers",
            "Export supplier list to Excel (Suppliers.xls)",
            "Import here — columns match the export 1:1",
          ]}
          onImport={() => setSupplierDialogOpen(true)}
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
