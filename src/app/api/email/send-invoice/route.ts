import { NextResponse } from "next/server";
import { z } from "zod";
import {
  buildInvoiceEmailHtml,
  buildInvoiceEmailSubject,
  buildInvoiceEmailText,
  parseEmailList,
  type InvoiceEmailPayload,
} from "@/lib/email/invoice-email";
import { isSmtpConfigured, sendEmail } from "@/lib/email/smtp";

const lineSchema = z.object({
  productService: z.string(),
  qty: z.number(),
  rate: z.number(),
});

const bodySchema = z.object({
  to: z.string().email(),
  cc: z.string().optional(),
  bcc: z.string().optional(),
  subject: z.string().min(1).optional(),
  emailBody: z.string().optional(),
  invoice: z.object({
    number: z.string().min(1),
    customerName: z.string().min(1),
    invoiceDate: z.string(),
    dueDate: z.string(),
    terms: z.string(),
    noteToCustomer: z.string(),
    lines: z.array(lineSchema),
    subtotal: z.number(),
    discountEnabled: z.boolean(),
    discountPercent: z.number(),
    discountAmount: z.number(),
    shippingEnabled: z.boolean(),
    shippingAmount: z.number(),
    invoiceTotal: z.number(),
    balanceDue: z.number(),
  }),
});

export async function POST(request: Request) {
  if (!isSmtpConfigured()) {
    return NextResponse.json(
      { error: "SMTP is not configured. Add SMTP_* variables to .env." },
      { status: 503 },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const fromName =
    process.env.SMTP_FROM_NAME?.replace(/^["']|["']$/g, "").trim() ||
    process.env.SMTP_FROM_EMAIL?.trim() ||
    "Your company";

  const payload: InvoiceEmailPayload = {
    ...parsed.data.invoice,
    noteToCustomer:
      parsed.data.emailBody?.trim() ||
      parsed.data.invoice.noteToCustomer ||
      "",
    fromName,
  };

  const subject =
    parsed.data.subject?.trim() || buildInvoiceEmailSubject(payload);

  try {
    const result = await sendEmail({
      to: parsed.data.to,
      cc: parseEmailList(parsed.data.cc),
      bcc: parseEmailList(parsed.data.bcc),
      subject,
      html: buildInvoiceEmailHtml(payload),
      text: buildInvoiceEmailText(payload),
    });

    return NextResponse.json({ ok: true, messageId: result.messageId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send email.";
    console.error("[send-invoice]", err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
