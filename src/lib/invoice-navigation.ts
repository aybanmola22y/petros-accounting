export const INVOICES_PATH = "/sales/invoices";

/** Opens the create-invoice dialog on the invoices page. */
export const NEW_INVOICE_SEARCH_PARAM = "newInvoice";

/** Pre-selects a status filter on the invoices page (e.g. Overdue). */
export const INVOICE_STATUS_SEARCH_PARAM = "status";

export function invoicesHref(openNewInvoiceDialog = false, statusFilter?: string): string {
  const params = new URLSearchParams();
  if (openNewInvoiceDialog) params.set(NEW_INVOICE_SEARCH_PARAM, "1");
  if (statusFilter) params.set(INVOICE_STATUS_SEARCH_PARAM, statusFilter);
  const q = params.toString();
  return q ? `${INVOICES_PATH}?${q}` : INVOICES_PATH;
}
