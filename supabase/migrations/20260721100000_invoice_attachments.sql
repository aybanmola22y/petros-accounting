-- Persist invoice form attachments (metadata + data URL) for View/Edit reload.
alter table public.invoices
  add column if not exists attachments jsonb;
