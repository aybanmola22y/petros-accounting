import type { InvoiceFormValues } from "@/components/invoice-form-dialog";
import type { InvoiceViewRow } from "@/lib/mock-data/adapters";
import type { MockInvoice } from "@/lib/mock-data/types";

const DEFAULT_LOCATION = "Head Office - Puerto Princesa City";
const DEFAULT_TAX = "Out of Scope of Tax";

type CustomerOption = { id: string; name: string; email?: string };

function termsFromInvoice(invoice: MockInvoice, viewRow?: InvoiceViewRow): string {
  if (invoice.kind === "paid") return "Paid";
  if (invoice.kind === "open") return "Due on receipt";
  if (viewRow?.status.kind === "overdue") return "Due on receipt";
  if (viewRow?.status.kind === "partial") return "Partially paid";
  return "Due on receipt";
}

/** Build invoice form state from a receivables invoice row. */
export function buildInvoicePrefillFromInvoice(
  invoice: MockInvoice,
  customers: CustomerOption[],
  viewRow?: InvoiceViewRow,
): InvoiceFormValues {
  const customerId =
    invoice.customerId || customers.find((c) => c.name === viewRow?.customer)?.id || "";

  const lineAmount = invoice.amount > 0 ? invoice.amount : invoice.balanceDue;
  const lines =
    invoice.lines && invoice.lines.length > 0
      ? invoice.lines.map((line) => ({ ...line }))
      : [
          {
            id: `inv-line-${invoice.id}`,
            serviceDate: invoice.date,
            productService: "",
            sku: "",
            description: "",
            qty: 1,
            rate: lineAmount,
            className: "",
          },
        ];

  return {
    customerId,
    number: invoice.number,
    terms: termsFromInvoice(invoice, viewRow),
    invoiceDate: invoice.date,
    dueDate: viewRow?.dueDate ?? invoice.date,
    tags: "",
    location: DEFAULT_LOCATION,
    taxSetting: DEFAULT_TAX,
    lines,
    noteToCustomer: "Thank you for making business with us!",
    memoOnStatement: "",
    discountEnabled: false,
    discountPercent: 0,
    depositEnabled: false,
    depositAmount: 0,
    shippingEnabled: false,
    shippingAmount: 0,
  };
}

export function invoiceStatusSidebarLabel(viewRow: InvoiceViewRow): string | null {
  if (viewRow.status.kind === "paid") return "Paid";
  if (viewRow.status.kind === "overdue" && viewRow.status.sub === "Viewed") return "Viewed";
  if (viewRow.status.kind === "overdue" && viewRow.status.sub === "Sent") return "Sent";
  if (viewRow.status.kind === "overdue") return "Overdue";
  if (viewRow.status.kind === "partial") return "Partially paid";
  if (viewRow.status.kind === "open") return "Open";
  return null;
}
