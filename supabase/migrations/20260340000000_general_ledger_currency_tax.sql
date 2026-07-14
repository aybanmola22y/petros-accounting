-- Optional QuickBooks General Ledger register columns.

alter table if exists public.general_ledger_rows
  add column if not exists foreign_currency_exchange_rate text not null default '',
  add column if not exists tax text not null default '';

