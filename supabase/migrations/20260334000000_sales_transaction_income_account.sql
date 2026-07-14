-- Income account per sale (e.g. Sales vs Sales of Product Income) for auto-generated P&L.

alter table public.sales_transactions
  add column if not exists income_account_name text;

create index if not exists idx_sales_transactions_income_account_name
  on public.sales_transactions (lower(income_account_name))
  where income_account_name is not null;
