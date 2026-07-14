-- Expense transactions (QuickBooks Expenses export:
-- Date, Type, No., Payee, Category, Total before sales tax, Sales tax, Total)

create table if not exists public.expense_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_date date not null,
  transaction_type text not null,
  reference_number text,
  payee text,
  category text,
  category_account_id uuid references public.chart_of_accounts (id) on delete set null,
  total_before_tax numeric(18, 2) not null default 0,
  sales_tax numeric(18, 2) not null default 0,
  total numeric(18, 2) not null,
  is_split boolean not null default false,
  payment_account_id uuid references public.chart_of_accounts (id) on delete set null,
  status text not null default 'paid',
  sort_order integer not null default 0,
  source_row_number integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_expense_transactions_transaction_date
  on public.expense_transactions (transaction_date desc);

create index if not exists idx_expense_transactions_transaction_type
  on public.expense_transactions (transaction_type);

create index if not exists idx_expense_transactions_category_account_id
  on public.expense_transactions (category_account_id);

create index if not exists idx_expense_transactions_payment_account_id
  on public.expense_transactions (payment_account_id);

create index if not exists idx_expense_transactions_payee
  on public.expense_transactions (payee);

create index if not exists idx_expense_transactions_sort_order
  on public.expense_transactions (sort_order);

create or replace function public.set_expense_transactions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_expense_transactions_updated_at on public.expense_transactions;

create trigger trg_expense_transactions_updated_at
before update on public.expense_transactions
for each row
execute function public.set_expense_transactions_updated_at();

alter table public.expense_transactions enable row level security;

drop policy if exists "Allow read expense_transactions" on public.expense_transactions;
create policy "Allow read expense_transactions"
  on public.expense_transactions for select
  using (true);

drop policy if exists "Allow write expense_transactions service" on public.expense_transactions;
create policy "Allow write expense_transactions service"
  on public.expense_transactions for all
  using (true)
  with check (true);
