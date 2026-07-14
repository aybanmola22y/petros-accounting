function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatPHP(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);
}

export type InvoiceEmailLine = {
  productService: string;
  qty: number;
  rate: number;
};

export type InvoiceEmailPayload = {
  number: string;
  customerName: string;
  invoiceDate: string;
  dueDate: string;
  terms: string;
  noteToCustomer: string;
  lines: InvoiceEmailLine[];
  subtotal: number;
  discountEnabled: boolean;
  discountPercent: number;
  discountAmount: number;
  shippingEnabled: boolean;
  shippingAmount: number;
  invoiceTotal: number;
  balanceDue: number;
  fromName: string;
};

export function buildInvoiceEmailSubject(payload: InvoiceEmailPayload): string {
  return `Invoice ${payload.number} from ${payload.fromName}`;
}

function emailMessage(payload: InvoiceEmailPayload): string {
  return payload.noteToCustomer?.trim() || "Please find your invoice details below.";
}

export function buildInvoiceEmailText(payload: InvoiceEmailPayload): string {
  return [
    emailMessage(payload),
    "",
    "---",
    `Invoice no. ${payload.number}`,
    `${payload.fromName}`,
    `Due ${payload.dueDate}`,
    `Balance due: ${formatPHP(payload.balanceDue)}`,
  ].join("\n");
}

function formatEmailBodyHtml(text: string): string {
  return `<div style="white-space:pre-wrap;font-size:14px;color:#374151;line-height:1.65;margin:0">${escapeHtml(text)}</div>`;
}

/** QBO-style online delivery layout: summary card + message body (matches send dialog preview). */
export function buildInvoiceEmailHtml(payload: InvoiceEmailPayload): string {
  const number = escapeHtml(payload.number);
  const company = escapeHtml(payload.fromName);
  const dueDate = escapeHtml(payload.dueDate);
  const amount = escapeHtml(formatPHP(payload.balanceDue));
  const messageHtml = formatEmailBodyHtml(emailMessage(payload));

  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:24px 16px;background:#f3f4f6;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;line-height:1.5">
    <div style="max-width:520px;margin:0 auto">
      <div style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;background:#ffffff;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
        <div style="padding:20px 20px 16px;background:#f9fafb;border-bottom:1px solid #e5e7eb">
          <p style="margin:0 0 8px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em">Invoice no. ${number}</p>
          <p style="margin:0 0 16px;font-size:18px;font-weight:600;color:#111827">${company}</p>
          <div style="background:#eceff3;border-radius:8px;padding:20px 16px;text-align:center">
            <p style="margin:0 0 8px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">Due ${dueDate}</p>
            <p style="margin:0;font-size:32px;font-weight:700;color:#111827;letter-spacing:-0.02em">${amount}</p>
          </div>
          <p style="margin:14px 0 0;font-size:10px;text-align:center;color:#9ca3af">Powered by PetroBook</p>
        </div>
        <div style="padding:20px;background:#ffffff">
          ${messageHtml}
        </div>
      </div>
      <p style="margin:16px 0 0;font-size:11px;color:#9ca3af;text-align:center">Sent by ${company}</p>
    </div>
  </body>
</html>`;
}

export function parseEmailList(raw: string | undefined): string[] | undefined {
  if (!raw?.trim()) return undefined;
  const list = raw
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length > 0 ? list : undefined;
}
