-- QuickBooks A/R Ageing Summary snapshot (per-customer bucket totals).

create table if not exists public.ar_aging_summary_rows (
  customer_name text primary key,
  current_amount numeric not null default 0,
  days_1_to_30 numeric not null default 0,
  days_31_to_60 numeric not null default 0,
  days_61_to_90 numeric not null default 0,
  days_91_plus numeric not null default 0,
  as_of text,
  sort_order integer not null default 0,
  imported_at timestamptz not null default now()
);

create index if not exists idx_ar_aging_summary_rows_sort
  on public.ar_aging_summary_rows (sort_order);

alter table public.ar_aging_summary_rows enable row level security;

drop policy if exists "Allow read ar_aging_summary_rows" on public.ar_aging_summary_rows;
create policy "Allow read ar_aging_summary_rows"
  on public.ar_aging_summary_rows for select
  using (true);

drop policy if exists "Allow write ar_aging_summary_rows service" on public.ar_aging_summary_rows;
create policy "Allow write ar_aging_summary_rows service"
  on public.ar_aging_summary_rows for all
  using (true)
  with check (true);
