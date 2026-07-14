-- Optional QuickBooks General Ledger register columns:
-- Class / Location, Foreign currency / exchange rate, and Tax.
-- Safe to run multiple times.

alter table if exists public.general_ledger_rows
  add column if not exists class_location text not null default '',
  add column if not exists foreign_currency_exchange_rate text not null default '',
  add column if not exists tax text not null default '';
