-- Sales transactions (QuickBooks sales.xls export:
-- Date, Type, No., Customer, Memo, Amount, Status)

create table if not exists public.sales_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_date date not null,
  transaction_type text not null,
  reference_number text,
  customer_name text,
  memo text,
  amount numeric(18, 2) not null,
  status text not null,
  sort_order integer not null default 0,
  source_row_number integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sales_transactions_transaction_date
  on public.sales_transactions (transaction_date desc);

create index if not exists idx_sales_transactions_transaction_type
  on public.sales_transactions (transaction_type);

create index if not exists idx_sales_transactions_customer_name_lower
  on public.sales_transactions (lower(customer_name));

create index if not exists idx_sales_transactions_status
  on public.sales_transactions (status);

create index if not exists idx_sales_transactions_sort_order
  on public.sales_transactions (sort_order);

create or replace function public.set_sales_transactions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_sales_transactions_updated_at on public.sales_transactions;

create trigger trg_sales_transactions_updated_at
before update on public.sales_transactions
for each row
execute function public.set_sales_transactions_updated_at();

alter table public.sales_transactions enable row level security;

drop policy if exists "Allow read sales_transactions" on public.sales_transactions;
create policy "Allow read sales_transactions"
  on public.sales_transactions for select
  using (true);

drop policy if exists "Allow write sales_transactions service" on public.sales_transactions;
create policy "Allow write sales_transactions service"
  on public.sales_transactions for all
  using (true)
  with check (true);
