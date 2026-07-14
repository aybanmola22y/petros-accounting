import type { ReceivePaymentFormValues } from "@/components/receive-payment-form-dialog";
import type { MockInvoice } from "@/lib/mock-data/types";
import type { MockSalesTransaction } from "@/lib/mock-data/sales";

type CustomerOption = {
  id: string;
  name: string;
  email?: string;
  openBalance?: number;
};

function invoiceNumberFromTxn(txn: MockSalesTransaction) {
  return txn.number.replace(/^INV-/i, "").trim() || txn.number;
}

export function buildReceivePaymentPrefillFromTransaction(
  txn: MockSalesTransaction,
  customers: CustomerOption[],
  openInvoices: MockInvoice[],
): ReceivePaymentFormValues {
  const customer =
    customers.find((c) => c.name === txn.customer) ?? customers[0];
  const customerId = customer?.id ?? "";

  if (txn.type === "Invoice" && txn.status.kind === "closed") {
    const invNum = invoiceNumberFromTxn(txn);
    const matchedInv = openInvoices.find(
      (inv) =>
        inv.customerId === customerId &&
        (inv.number === invNum || inv.number === txn.number),
    );
    return {
      customerId,
      email: customer?.email ?? "",
      sendLater: false,
      paymentDate: txn.date,
      paymentMethod: "Cash",
      referenceNo: "",
      depositToId: "",
      amountReceived: txn.amount,
      memo: txn.memo,
      lines: [
        {
          id: matchedInv?.id ?? txn.id,
          description: `Invoice # ${invNum} (${txn.date})`,
          dueDate: txn.date,
          originalAmount: txn.amount,
          openBalance: txn.amount,
          payment: txn.amount,
          selected: true,
        },
      ],
    };
  }

  if (txn.type === "Payment" && txn.status.kind === "closed") {
    const matchedInv =
      openInvoices.find(
        (inv) =>
          inv.customerId === customerId &&
          (inv.amount === txn.amount || inv.balanceDue === txn.amount),
      ) ?? openInvoices.find((inv) => inv.customerId === customerId);

    const invNum = matchedInv?.number ?? "—";
    return {
      customerId,
      email: customer?.email ?? "",
      sendLater: false,
      paymentDate: txn.date,
      paymentMethod: "Cash",
      referenceNo: txn.number.replace(/^PMT-/i, ""),
      depositToId: "",
      amountReceived: txn.amount,
      memo: txn.memo,
      lines: [
        {
          id: matchedInv?.id ?? txn.id,
          description: `Invoice # ${invNum} (${matchedInv?.date ?? txn.date})`,
          dueDate: matchedInv?.date ?? txn.date,
          originalAmount: matchedInv?.amount ?? txn.amount,
          openBalance: matchedInv?.balanceDue ?? txn.amount,
          payment: txn.amount,
          selected: true,
        },
      ],
    };
  }

  const customerInvoices = openInvoices.filter(
    (inv) =>
      inv.customerId === customerId &&
      inv.balanceDue > 0 &&
      inv.kind !== "paid",
  );

  const lines = customerInvoices.map((inv) => ({
    id: inv.id,
    description: `Invoice ${inv.number}`,
    dueDate: inv.date,
    originalAmount: inv.amount,
    openBalance: inv.balanceDue,
    payment: 0,
    selected: false,
  }));

  return {
    customerId,
    email: customer?.email ?? "",
    sendLater: false,
    paymentDate: txn.date,
    paymentMethod: "Cash",
    referenceNo: txn.number.replace(/^PMT-/i, ""),
    depositToId: "",
    amountReceived: txn.amount,
    memo: txn.memo,
    lines,
  };
}

export function buildReceivePaymentPrefillFromInvoice(
  invoice: MockInvoice,
  customers: CustomerOption[],
  dueDate?: string,
): ReceivePaymentFormValues {
  const customer = customers.find((c) => c.id === invoice.customerId) ?? customers[0];
  const customerId = customer?.id ?? "";

  return {
    customerId,
    email: customer?.email ?? "",
    sendLater: false,
    paymentDate: invoice.date,
    paymentMethod: "Cash",
    referenceNo: "",
    depositToId: "",
    amountReceived: invoice.balanceDue,
    memo: "",
    lines: [
      {
        id: invoice.id,
        description: `Invoice ${invoice.number} (${invoice.date})`,
        dueDate: dueDate ?? invoice.date,
        originalAmount: invoice.amount,
        openBalance: invoice.balanceDue,
        payment: invoice.balanceDue,
        selected: true,
      },
    ],
  };
}
