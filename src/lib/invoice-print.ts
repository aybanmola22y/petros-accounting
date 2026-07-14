import type { InvoiceFormValues } from "@/components/invoice-form-dialog";
import { formatPHP } from "@/views/financial-report-shared";

type InvoicePrintStatus = "paid" | "overdue" | "partial" | "open" | "void";

type PrintInvoiceInput = {
  number: string;
  customerName: string;
  customerAddress?: string;
  invoiceDate: string;
  dueDate: string;
  terms: string;
  noteToCustomer?: string;
  lines: InvoiceFormValues["lines"];
  discountEnabled?: boolean;
  discountPercent?: number;
  shippingEnabled?: boolean;
  shippingAmount?: number;
  depositEnabled?: boolean;
  depositAmount?: number;
  status?: InvoicePrintStatus;
  amountPaid?: number;
  balanceDueOverride?: number;
};

/** Issuing company — shown in the printed letterhead. */
const COMPANY = {
  name: "Petrosphere Inc.",
  addressLines: [
    "Unit 305, 3F, Trigold Business Park,",
    "National Highway, Brgy. San Pedro,",
    "Puerto Princesa City, Palawan 5300 PHL",
  ],
  email: "admin@petrosphere.com.ph",
  website: "www.petrosphere.com.ph",
};

const BRAND = "#0f2350"; // navy (primary)
const BRAND_DARK = "#0a1838";
const GOLD = "#c8a13a"; // gold (secondary)
const GOLD_LIGHT = "#e2c463";
const INK = "#1f2937";
const MUTED = "#6b7280";
const LINE = "#e5e7eb";

/** Real logo served from /public; falls back to the SVG monogram if absent. */
const LOGO_URL =
  typeof window !== "undefined" ? `${window.location.origin}/logo.png` : "/logo.png";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function invoiceTotals(values: PrintInvoiceInput) {
  const subtotal = values.lines.reduce((sum, line) => sum + line.qty * line.rate, 0);
  const discount = values.discountEnabled ? (subtotal * (values.discountPercent ?? 0)) / 100 : 0;
  const shipping = values.shippingEnabled ? (values.shippingAmount ?? 0) : 0;
  const invoiceTotal = Math.max(0, subtotal - discount + shipping);

  const isPaid = values.status === "paid";
  const balanceDue = isPaid
    ? 0
    : values.balanceDueOverride != null
      ? Math.max(0, values.balanceDueOverride)
      : Math.max(0, invoiceTotal - (values.depositEnabled ? (values.depositAmount ?? 0) : 0));
  const amountPaid =
    values.amountPaid != null ? values.amountPaid : Math.max(0, invoiceTotal - balanceDue);

  return { subtotal, discount, shipping, invoiceTotal, balanceDue, amountPaid };
}

function statusStamp(status: InvoicePrintStatus | undefined): string {
  const map: Record<InvoicePrintStatus, { label: string; color: string } | null> = {
    paid: { label: "PAID", color: "#16a34a" },
    overdue: { label: "OVERDUE", color: "#dc2626" },
    partial: { label: "PARTIAL", color: "#d97706" },
    void: { label: "VOID", color: "#6b7280" },
    open: null,
  };
  const config = status ? map[status] : null;
  if (!config) return "";
  return `<div class="stamp" style="color:${config.color};border-color:${config.color}">${config.label}</div>`;
}

const LOGO_SVG = `
<svg width="50" height="50" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="drop" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${BRAND}"/>
      <stop offset="1" stop-color="${BRAND_DARK}"/>
    </linearGradient>
  </defs>
  <path d="M32 3C32 3 53 27 53 42a21 21 0 1 1-42 0C11 27 32 3 32 3Z" fill="url(#drop)"/>
  <circle cx="32" cy="42" r="9" fill="${GOLD_LIGHT}"/>
  <circle cx="32" cy="42" r="4.4" fill="${GOLD}"/>
</svg>`;

/** Real logo image with graceful fallback to the inline monogram. */
const LOGO_HTML = `<span class="logo-wrap">
  <img class="logo-img" src="${LOGO_URL}" alt="Logo"
    onerror="this.style.display='none';var f=this.nextElementSibling;if(f)f.style.display='inline-flex';">
  <span class="logo-fallback" style="display:none">${LOGO_SVG}</span>
</span>`;

const PRINT_STYLES = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    color: ${INK};
    background: #f3f4f6;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .sheet {
    position: relative;
    max-width: 820px;
    margin: 24px auto;
    background: #fff;
    padding: 0 0 36px;
    box-shadow: 0 10px 40px rgba(15,23,42,0.12);
    overflow: hidden;
  }
  .topbar { height: 7px; background: ${BRAND}; }
  .topbar-gold { height: 3px; background: ${GOLD}; }
  .pad { padding: 0 44px; }

  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; padding-top: 32px; }
  .brand { display: flex; gap: 14px; align-items: flex-start; }
  .logo-wrap { display: inline-flex; }
  .logo-img { height: 52px; width: auto; max-width: 160px; object-fit: contain; }
  .brand-name { font-size: 19px; font-weight: 700; color: ${BRAND_DARK}; line-height: 1.15; }
  .brand-meta { margin-top: 8px; font-size: 11.5px; color: ${MUTED}; line-height: 1.55; }
  .brand-meta a { color: ${BRAND}; text-decoration: none; }

  .title-block { text-align: right; }
  .title { font-size: 34px; font-weight: 800; letter-spacing: 4px; color: ${BRAND}; line-height: 1; }
  .title-rule { height: 3px; width: 64px; background: ${GOLD}; margin: 7px 0 0 auto; border-radius: 2px; }
  .inv-no { margin-top: 6px; font-size: 13px; color: ${MUTED}; }
  .inv-no b { color: ${INK}; }

  .meta { display: flex; justify-content: space-between; gap: 24px; margin-top: 28px; }
  .billto { font-size: 12.5px; line-height: 1.55; max-width: 52%; }
  .label { font-size: 10.5px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: ${GOLD}; margin-bottom: 5px; }
  .cust-name { font-weight: 700; font-size: 14px; color: ${INK}; }
  .cust-addr { color: ${MUTED}; white-space: pre-line; }
  .facts { border-collapse: collapse; font-size: 12px; min-width: 250px; }
  .facts td { padding: 4px 0; }
  .facts td:first-child { color: ${MUTED}; padding-right: 22px; text-transform: uppercase; font-size: 10.5px; letter-spacing: .6px; }
  .facts td:last-child { text-align: right; font-weight: 600; }

  table.items { width: 100%; border-collapse: collapse; margin-top: 26px; font-size: 12.5px; }
  table.items thead th {
    background: ${BRAND}; color: #fff; text-align: left; font-weight: 600;
    padding: 10px 12px; font-size: 11px; letter-spacing: .5px; text-transform: uppercase;
  }
  table.items thead th.num { text-align: right; }
  table.items tbody td { padding: 11px 12px; border-bottom: 1px solid ${LINE}; vertical-align: top; }
  table.items tbody tr:nth-child(even) td { background: #f8fafc; }
  td.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .act-name { font-weight: 600; color: ${INK}; }
  .act-desc { color: ${MUTED}; font-size: 11.5px; margin-top: 2px; }

  .totals { display: flex; justify-content: flex-end; align-items: center; gap: 24px; margin-top: 18px; }
  .totals-inner { width: 300px; font-size: 12.5px; }
  .totals-inner .row { display: flex; justify-content: space-between; padding: 6px 0; }
  .totals-inner .row.muted span:first-child { color: ${MUTED}; }
  .totals-inner .total { border-top: 2px solid ${INK}; margin-top: 4px; padding-top: 9px; font-weight: 700; font-size: 14px; }
  .balance { margin-top: 10px; display: flex; justify-content: space-between; align-items: center;
    background: ${BRAND}; color: #fff; padding: 11px 16px; border-radius: 8px; font-weight: 700;
    border-left: 4px solid ${GOLD}; }
  .balance .amt { font-size: 17px; color: ${GOLD_LIGHT}; }

  .note { margin-top: 30px; padding-top: 16px; border-top: 1px solid ${LINE}; font-size: 12px; color: ${MUTED}; line-height: 1.6; }
  .note b { color: ${INK}; }
  .thanks { margin-top: 18px; text-align: center; font-size: 12.5px; color: ${BRAND_DARK}; font-weight: 600; }

  .stamp {
    margin-right: auto; align-self: center; transform: rotate(-13deg);
    border: 5px solid; border-radius: 12px; padding: 8px 26px;
    font-size: 40px; font-weight: 800; letter-spacing: 6px; opacity: .5; pointer-events: none;
  }

  @page { size: A4; margin: 12mm; }
  @media print {
    body { background: #fff; }
    .sheet { box-shadow: none; margin: 0; max-width: none; }
  }
`;

/** Print via hidden iframe — avoids browser pop-up blockers. */
function openPrintWindow(title: string, bodyHtml: string): boolean {
  if (typeof document === "undefined") return false;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", title);
  iframe.setAttribute(
    "style",
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;",
  );
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  if (!frameWindow) {
    iframe.remove();
    return false;
  }

  frameWindow.document.open();
  frameWindow.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
    <style>${PRINT_STYLES}</style></head><body>
    ${bodyHtml}
    </body></html>`);
  frameWindow.document.close();

  const cleanup = () => iframe.remove();
  frameWindow.addEventListener("afterprint", cleanup, { once: true });
  window.setTimeout(cleanup, 60_000);

  // Give the iframe a tick to lay out before invoking print.
  window.setTimeout(() => {
    frameWindow.focus();
    frameWindow.print();
  }, 150);
  return true;
}

function companyHeaderHtml(): string {
  return `
    <div class="brand">
      ${LOGO_HTML}
      <div>
        <div class="brand-name">${escapeHtml(COMPANY.name)}</div>
        <div class="brand-meta">
          ${COMPANY.addressLines.map((l) => escapeHtml(l)).join("<br>")}<br>
          <a href="mailto:${escapeHtml(COMPANY.email)}">${escapeHtml(COMPANY.email)}</a> ·
          <a href="https://${escapeHtml(COMPANY.website)}">${escapeHtml(COMPANY.website)}</a>
        </div>
      </div>
    </div>`;
}

export function openInvoicePrintPreview(values: PrintInvoiceInput): boolean {
  const { subtotal, discount, shipping, invoiceTotal, balanceDue, amountPaid } =
    invoiceTotals(values);

  const linesHtml = values.lines
    .filter((l) => l.productService || l.description || l.qty * l.rate > 0)
    .map((l) => {
      const name = escapeHtml(l.productService || l.description || "—");
      const desc =
        l.description && l.productService
          ? `<div class="act-desc">${escapeHtml(l.description)}</div>`
          : "";
      return `<tr>
        <td>${escapeHtml(l.serviceDate || values.invoiceDate)}</td>
        <td><div class="act-name">${name}</div>${desc}</td>
        <td class="num">${l.qty}</td>
        <td class="num">${formatPHP(l.rate)}</td>
        <td class="num">${formatPHP(l.qty * l.rate)}</td>
      </tr>`;
    })
    .join("");

  const body = `
    <div class="sheet">
      <div class="topbar"></div>
      <div class="topbar-gold"></div>
      <div class="pad">
        <div class="head">
          ${companyHeaderHtml()}
          <div class="title-block">
            <div class="title">INVOICE</div>
            <div class="title-rule"></div>
            <div class="inv-no">No. <b>${escapeHtml(values.number)}</b></div>
          </div>
        </div>

        <div class="meta">
          <div class="billto">
            <div class="label">Bill to</div>
            <div class="cust-name">${escapeHtml(values.customerName)}</div>
            ${values.customerAddress ? `<div class="cust-addr">${escapeHtml(values.customerAddress)}</div>` : ""}
          </div>
          <table class="facts">
            <tr><td>Invoice date</td><td>${escapeHtml(values.invoiceDate)}</td></tr>
            <tr><td>Due date</td><td>${escapeHtml(values.dueDate)}</td></tr>
            <tr><td>Terms</td><td>${escapeHtml(values.terms)}</td></tr>
          </table>
        </div>

        <table class="items">
          <thead>
            <tr>
              <th style="width:15%">Date</th>
              <th>Activity</th>
              <th class="num" style="width:9%">Qty</th>
              <th class="num" style="width:16%">Rate</th>
              <th class="num" style="width:18%">Amount</th>
            </tr>
          </thead>
          <tbody>${linesHtml || `<tr><td colspan="5" style="text-align:center;color:${MUTED}">No line items</td></tr>`}</tbody>
        </table>

        <div class="totals">
          ${statusStamp(values.status)}
          <div class="totals-inner">
            <div class="row muted"><span>Subtotal</span><span>${formatPHP(subtotal)}</span></div>
            ${values.discountEnabled ? `<div class="row muted"><span>Discount (${values.discountPercent ?? 0}%)</span><span>-${formatPHP(discount)}</span></div>` : ""}
            ${values.shippingEnabled ? `<div class="row muted"><span>Shipping</span><span>${formatPHP(shipping)}</span></div>` : ""}
            <div class="row total"><span>Total</span><span>${formatPHP(invoiceTotal)}</span></div>
            ${amountPaid > 0 ? `<div class="row muted"><span>Payment</span><span>-${formatPHP(amountPaid)}</span></div>` : ""}
            <div class="balance"><span>Balance due</span><span class="amt">${formatPHP(balanceDue)}</span></div>
          </div>
        </div>

        ${values.noteToCustomer ? `<div class="note"><b>Note</b><br>${escapeHtml(values.noteToCustomer)}</div>` : ""}
        <div class="thanks">Thank you for doing business with ${escapeHtml(COMPANY.name)}!</div>
      </div>
    </div>`;

  return openPrintWindow(`Invoice ${values.number}`, body);
}

export function openPackingSlipPrint(values: PrintInvoiceInput): boolean {
  const linesHtml = values.lines
    .filter((l) => l.productService || l.description || l.qty > 0)
    .map(
      (l) => `<tr>
        <td><div class="act-name">${escapeHtml(l.productService || l.description || "—")}</div></td>
        <td>${escapeHtml(l.sku || "—")}</td>
        <td class="num">${l.qty}</td>
      </tr>`,
    )
    .join("");

  const body = `
    <div class="sheet">
      <div class="topbar"></div>
      <div class="topbar-gold"></div>
      <div class="pad">
        <div class="head">
          ${companyHeaderHtml()}
          <div class="title-block">
            <div class="title" style="font-size:26px;letter-spacing:2px">PACKING SLIP</div>
            <div class="title-rule"></div>
            <div class="inv-no">Invoice <b>${escapeHtml(values.number)}</b></div>
          </div>
        </div>

        <div class="meta">
          <div class="billto">
            <div class="label">Ship to</div>
            <div class="cust-name">${escapeHtml(values.customerName)}</div>
            ${values.customerAddress ? `<div class="cust-addr">${escapeHtml(values.customerAddress)}</div>` : ""}
          </div>
          <table class="facts">
            <tr><td>Date</td><td>${escapeHtml(values.invoiceDate)}</td></tr>
          </table>
        </div>

        <table class="items">
          <thead>
            <tr><th>Product / service</th><th style="width:24%">SKU</th><th class="num" style="width:12%">Qty</th></tr>
          </thead>
          <tbody>${linesHtml || `<tr><td colspan="3" style="text-align:center;color:${MUTED}">No items</td></tr>`}</tbody>
        </table>

        <div class="thanks">Thank you for doing business with ${escapeHtml(COMPANY.name)}!</div>
      </div>
    </div>`;

  return openPrintWindow(`Packing slip ${values.number}`, body);
}
