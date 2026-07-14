-- QuickBooks Expenses by Supplier Summary snapshot for Expenses Performance.

create table if not exists public.expenses_by_supplier_summary_rows (
  id uuid primary key default gen_random_uuid(),
  supplier_name text not null,
  amount numeric not null default 0,
  period_label text,
  total_amount numeric,
  sort_order integer not null default 0,
  imported_at timestamptz not null default now()
);

create index if not exists idx_expenses_by_supplier_summary_sort
  on public.expenses_by_supplier_summary_rows (sort_order);

create index if not exists idx_expenses_by_supplier_summary_supplier
  on public.expenses_by_supplier_summary_rows (lower(supplier_name));

alter table public.expenses_by_supplier_summary_rows enable row level security;

drop policy if exists "Allow read expenses_by_supplier_summary_rows"
  on public.expenses_by_supplier_summary_rows;
create policy "Allow read expenses_by_supplier_summary_rows"
  on public.expenses_by_supplier_summary_rows for select
  using (true);

drop policy if exists "Allow write expenses_by_supplier_summary_rows service"
  on public.expenses_by_supplier_summary_rows;
create policy "Allow write expenses_by_supplier_summary_rows service"
  on public.expenses_by_supplier_summary_rows for all
  using (true)
  with check (true);
