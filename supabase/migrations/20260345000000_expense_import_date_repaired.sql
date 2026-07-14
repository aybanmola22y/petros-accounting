-- Tracks one-time timezone repair for QuickBooks expense imports (UTC toISOString shift).

alter table public.expense_transactions
  add column if not exists import_date_repaired boolean not null default false;

update public.expense_transactions
set import_date_repaired = false
where source_row_number is not null;
