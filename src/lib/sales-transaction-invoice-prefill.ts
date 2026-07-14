import type { InvoiceFormValues } from "@/components/invoice-form-dialog";
import type { MockSalesTransaction } from "@/lib/mock-data/sales";

const DEFAULT_LOCATION = "Head Office - Puerto Princesa City";
const DEFAULT_TAX = "Out of Scope of Tax";

type CustomerOption = { id: string; name: string };

export function buildInvoicePrefillFromTransaction(
  txn: MockSalesTransaction,
  customers: CustomerOption[],
): InvoiceFormValues {
  const customerId =
    customers.find((c) => c.name === txn.customer)?.id ?? customers[0]?.id ?? "";
  const number = txn.number.replace(/^(INV|PMT)-/i, "").trim() || txn.number;
  const terms =
    txn.status.kind === "overdue"
      ? txn.status.detail
      : txn.status.kind === "closed"
        ? "Paid"
        : "Due on receipt";

  return {
    customerId,
    number,
    terms,
    invoiceDate: txn.date,
    dueDate: txn.date,
    tags: "",
    location: DEFAULT_LOCATION,
    taxSetting: DEFAULT_TAX,
    lines: [
      {
        id: `inv-line-${txn.id}`,
        serviceDate: txn.date,
        productService: "",
        sku: "",
        description: txn.memo,
        qty: 1,
        rate: txn.amount,
        className: "",
      },
    ],
    noteToCustomer: txn.memo || "Thank you for making business with us!",
    memoOnStatement: "",
    discountEnabled: false,
    discountPercent: 0,
    depositEnabled: false,
    depositAmount: 0,
    shippingEnabled: false,
    shippingAmount: 0,
  };
}
