"use client";

import { useEffect, useMemo, useState } from "react";
import { Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import { openInvoicePrintPreview } from "@/lib/invoice-print";
import { recordInvoiceSent } from "@/lib/mock-data";
import { formatPHP } from "@/views/financial-report-shared";
import { cn } from "@/lib/utils";

const COMPANY_NAME = "Petrosphere Inc.";
const FROM_OPTIONS = [
  { id: "default", label: `${COMPANY_NAME} <notifications@petrosphere.com>` },
  { id: "billing", label: `${COMPANY_NAME} <billing@petrosphere.com>` },
];

export type SendInvoiceLine = {
  productService: string;
  qty: number;
  rate: number;
};

export type SendInvoicePayload = {
  invoiceId?: string | null;
  number: string;
  customerName: string;
  customerEmail?: string;
  invoiceDate: string;
  dueDate: string;
  terms: string;
  noteToCustomer: string;
  lines: SendInvoiceLine[];
  discountEnabled?: boolean;
  discountPercent?: number;
  shippingEnabled?: boolean;
  shippingAmount?: number;
  depositEnabled?: boolean;
  depositAmount?: number;
};

export type SendInvoiceDialogMode = "invoice" | "reminder";

type SendInvoiceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payload: SendInvoicePayload | null;
  mode?: SendInvoiceDialogMode;
  /** Called before send — return false to abort (e.g. save failed). */
  onBeforeSend?: () => boolean | Promise<boolean>;
  onSent?: () => void;
};

function defaultEmailBody(customerName: string) {
  return `Dear ${customerName},

Greetings from ${COMPANY_NAME}!

We are sending you a copy of the invoice.

Payment can be deposited to the following:

Bank: Bank of the Philippines Islands (BPI)
Account name: PETROSPHERE INCORPORATED
Account no. : 3481-0038-99  –  Current Account

Debit/Credit Card
Kindly reply to this email should you wish to pay using your debit/credit card.  Be advised that additional fees may be incurred by using this option.

NOTE: Please send the scanned copy of deposit slip to
sales@petrosphere.com.ph as proof of payment.

Thank you for choosing Petrosphere!

Regards,
${COMPANY_NAME}`;
}

function defaultReminderEmailBody(customerName: string) {
  return `Dear ${customerName},

Just a reminder that we have not received a payment for this invoice yet. Let us know if you have any questions.

Thanks for your business!

Sincerely yours,
Petrosphere Incorporated.`;
}

function invoiceTotals(payload: SendInvoicePayload) {
  const subtotal = payload.lines.reduce((sum, l) => sum + l.qty * l.rate, 0);
  const discount = payload.discountEnabled
    ? (subtotal * (payload.discountPercent ?? 0)) / 100
    : 0;
  const shipping = payload.shippingEnabled ? (payload.shippingAmount ?? 0) : 0;
  const invoiceTotal = Math.max(0, subtotal - discount + shipping);
  const balanceDue = Math.max(
    0,
    invoiceTotal - (payload.depositEnabled ? (payload.depositAmount ?? 0) : 0),
  );
  return { subtotal, discount, shipping, invoiceTotal, balanceDue };
}

export function SendInvoiceDialog({
  open,
  onOpenChange,
  payload,
  mode = "invoice",
  onBeforeSend,
  onSent,
}: SendInvoiceDialogProps) {
  const { toast } = useToast();
  const [fromId, setFromId] = useState("default");
  const [toEmail, setToEmail] = useState("");
  const [ccBccOpen, setCcBccOpen] = useState(false);
  const [ccEmails, setCcEmails] = useState("");
  const [bccEmails, setBccEmails] = useState("");
  const [sendMeCopy, setSendMeCopy] = useState(false);
  const [subject, setSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sending, setSending] = useState(false);

  const totals = useMemo(
    () => (payload ? invoiceTotals(payload) : null),
    [payload],
  );

  useEffect(() => {
    if (!open || !payload) return;
    setToEmail(payload.customerEmail?.trim() ?? "");
    if (mode === "reminder") {
      setSubject(`Reminder: Invoice ${payload.number} from ${COMPANY_NAME}`);
      setEmailBody(defaultReminderEmailBody(payload.customerName));
    } else {
      setSubject(`Invoice ${payload.number} from ${COMPANY_NAME}`);
      setEmailBody(defaultEmailBody(payload.customerName));
    }
    setCcBccOpen(false);
    setCcEmails("");
    setBccEmails("");
    setSendMeCopy(false);
    setFromId("default");
  }, [open, payload, mode]);

  async function handleSend() {
    if (!payload || !totals) return;
    if (!toEmail.trim()) {
      toast({
        title: "Email required",
        description: "Enter a recipient email address.",
        variant: "destructive",
      });
      return;
    }

    const beforeSend = onBeforeSend ? await onBeforeSend() : true;
    if (beforeSend === false) return;

    setSending(true);
    try {
      const res = await fetch("/api/email/send-invoice", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          to: toEmail.trim(),
          subject: subject.trim() || undefined,
          emailBody: emailBody.trim() || undefined,
          cc: ccEmails.trim() || undefined,
          bcc: [
            ...(bccEmails.trim() ? [bccEmails.trim()] : []),
            ...(sendMeCopy ? ["billing@petrosphere.com"] : []),
          ]
            .filter(Boolean)
            .join(",") || undefined,
          invoice: {
            number: payload.number,
            customerName: payload.customerName,
            invoiceDate: payload.invoiceDate,
            dueDate: payload.dueDate,
            terms: payload.terms,
            noteToCustomer: emailBody.trim() || payload.noteToCustomer,
            lines: payload.lines,
            subtotal: totals.subtotal,
            discountEnabled: Boolean(payload.discountEnabled),
            discountPercent: payload.discountPercent ?? 0,
            discountAmount: totals.discount,
            shippingEnabled: Boolean(payload.shippingEnabled),
            shippingAmount: totals.shipping,
            invoiceTotal: totals.invoiceTotal,
            balanceDue: totals.balanceDue,
          },
        }),
      });

      const contentType = res.headers.get("content-type") ?? "";
      const data = contentType.includes("application/json")
        ? ((await res.json()) as { error?: string; ok?: boolean; messageId?: string })
        : null;

      if (!data) {
        toast({
          title: "Could not send invoice",
          description: "Unexpected server response. Sign in again and retry.",
          variant: "destructive",
        });
        return;
      }

      if (!res.ok) {
        toast({
          title: "Could not send invoice",
          description: data.error ?? "The email could not be sent.",
          variant: "destructive",
        });
        return;
      }

      if (mode === "invoice" && payload.invoiceId) {
        void recordInvoiceSent(payload.invoiceId);
      }

      toast({
        title: mode === "reminder" ? "Reminder sent" : "Invoice sent",
        description:
          mode === "reminder"
            ? `Payment reminder for invoice ${payload.number} sent to ${toEmail.trim()}.`
            : `Invoice ${payload.number} sent to ${toEmail.trim()}.`,
      });
      onOpenChange(false);
      onSent?.();
    } catch {
      toast({
        title: "Could not send invoice",
        description: "A network error occurred while sending email.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  }

  function handlePrintPreview() {
    if (!payload) return;
    openInvoicePrintPreview({
      number: payload.number,
      customerName: payload.customerName,
      invoiceDate: payload.invoiceDate,
      dueDate: payload.dueDate,
      terms: payload.terms,
      noteToCustomer: payload.noteToCustomer,
      lines: payload.lines.map((l) => ({
        id: l.productService,
        serviceDate: payload.invoiceDate,
        productService: l.productService,
        sku: "",
        description: "",
        qty: l.qty,
        rate: l.rate,
        className: "",
      })),
      discountEnabled: payload.discountEnabled,
      discountPercent: payload.discountPercent,
      shippingEnabled: payload.shippingEnabled,
      shippingAmount: payload.shippingAmount,
      depositEnabled: payload.depositEnabled,
      depositAmount: payload.depositAmount,
    });
  }

  if (!payload) return null;

  const ccBccLabel =
    ccEmails.trim() || bccEmails.trim()
      ? `${[ccEmails.trim(), bccEmails.trim()].filter(Boolean).length} Cc/Bcc`
      : "Cc/Bcc";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-xl font-semibold">
            Send Invoice {payload.number}
          </DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-0 min-h-[480px]">
          <div className="px-6 py-5 space-y-4 border-r">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">From</Label>
              <Select value={fromId} onValueChange={setFromId}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FROM_OPTIONS.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs text-muted-foreground">To</Label>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => setCcBccOpen((v) => !v)}
                >
                  {ccBccOpen ? "Hide Cc/Bcc" : ccBccLabel}
                </button>
              </div>
              <Input
                type="email"
                className="h-10"
                value={toEmail}
                onChange={(e) => setToEmail(e.target.value)}
                placeholder="customer@email.com"
              />
              {ccBccOpen ? (
                <div className="grid gap-2 pt-1">
                  <Input
                    className="h-9 text-sm"
                    placeholder="Cc"
                    value={ccEmails}
                    onChange={(e) => setCcEmails(e.target.value)}
                  />
                  <Input
                    className="h-9 text-sm"
                    placeholder="Bcc"
                    value={bccEmails}
                    onChange={(e) => setBccEmails(e.target.value)}
                  />
                </div>
              ) : null}
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={sendMeCopy}
                onCheckedChange={(v) => setSendMeCopy(v === true)}
              />
              Send me a copy
            </label>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Subject</Label>
              <Input
                className="h-10"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Paperclip className="h-4 w-4 shrink-0" />
              <span>Invoice PDF</span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Email body</Label>
              <Textarea
                className="min-h-[220px] resize-y text-sm font-normal leading-relaxed"
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
              />
            </div>

            <button
              type="button"
              className="text-sm text-primary hover:underline"
              onClick={() =>
                toast({
                  title: "Online delivery",
                  description: "Configure default email templates in company settings.",
                })
              }
            >
              Manage online delivery settings
            </button>
          </div>

          <div className="px-6 py-5 bg-muted/20 flex flex-col min-h-0">
            <div className="flex-1 rounded-lg border bg-card shadow-sm overflow-hidden flex flex-col min-h-[380px] max-h-[min(520px,60vh)]">
              <div className="flex-1 overflow-y-auto text-sm">
                <div className="p-5 space-y-3 border-b bg-muted/40">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Invoice no. {payload.number}
                  </p>
                  <p className="text-lg font-semibold">{COMPANY_NAME}</p>
                  <div className="rounded-md bg-muted/60 p-4 space-y-3 text-center">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Due {payload.dueDate}
                    </p>
                    <p className="text-3xl font-bold tabular-nums">
                      {formatPHP(totals?.balanceDue ?? 0)}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      className="bg-slate-800 hover:bg-slate-900"
                      onClick={handlePrintPreview}
                    >
                      Print or save
                    </Button>
                  </div>
                  <p className="text-[10px] text-center text-muted-foreground">
                    Powered by PetroBook
                  </p>
                </div>
                <div className="p-5 bg-background">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                    {emailBody ||
                      (mode === "reminder"
                        ? defaultReminderEmailBody(payload.customerName)
                        : defaultEmailBody(payload.customerName))}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            className="text-emerald-700 hover:text-emerald-800 hover:bg-transparent px-0"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className={cn("bg-emerald-600 hover:bg-emerald-700 min-w-5.5rem")}
            onClick={handleSend}
            disabled={sending}
          >
            {sending ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
