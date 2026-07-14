-- Invoice/sales line items from QuickBooks "Sales by Product/Service Detail".
-- sales_transactions stores only a single memo + amount per transaction, so per-line
-- product/service + description + qty + rate live here, matched by reference number.

create table if not exists public.sales_transaction_lines (
  id uuid primary key default gen_random_uuid(),
  reference_number text not null,
  sort_order int not null default 0,
  product_service text,
  description text,
  quantity numeric,
  rate numeric,
  amount numeric,
  created_at timestamptz not null default now()
);

create index if not exists idx_sales_transaction_lines_reference
  on public.sales_transaction_lines (reference_number);

alter table public.sales_transaction_lines enable row level security;

drop policy if exists "Allow read sales_transaction_lines" on public.sales_transaction_lines;
create policy "Allow read sales_transaction_lines"
  on public.sales_transaction_lines for select
  using (true);

drop policy if exists "Allow write sales_transaction_lines service" on public.sales_transaction_lines;
create policy "Allow write sales_transaction_lines service"
  on public.sales_transaction_lines for all
  using (true)
  with check (true);
