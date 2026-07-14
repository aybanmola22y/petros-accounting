-- Optional QuickBooks General Ledger Class/Location column.

alter table if exists public.general_ledger_rows
  add column if not exists class_location text not null default '';

