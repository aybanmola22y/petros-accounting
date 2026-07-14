-- QuickBooks A/R Ageing Detail snapshot (amount + open balance per transaction).

create table if not exists public.ar_aging_detail_lines (
  id uuid primary key default gen_random_uuid(),
  reference_number text not null,
  transaction_type text not null,
  transaction_date text,
  customer_name text,
  location text,
  due_date text,
  amount numeric not null default 0,
  open_balance numeric not null default 0,
  bucket text not null,
  sort_order integer not null default 0,
  imported_at timestamptz not null default now()
);

create index if not exists idx_ar_aging_detail_lines_bucket_sort
  on public.ar_aging_detail_lines (bucket, sort_order);

create index if not exists idx_ar_aging_detail_lines_reference_number
  on public.ar_aging_detail_lines (reference_number);

alter table public.ar_aging_detail_lines enable row level security;

drop policy if exists "Allow read ar_aging_detail_lines" on public.ar_aging_detail_lines;
create policy "Allow read ar_aging_detail_lines"
  on public.ar_aging_detail_lines for select
  using (true);

drop policy if exists "Allow write ar_aging_detail_lines service" on public.ar_aging_detail_lines;
create policy "Allow write ar_aging_detail_lines service"
  on public.ar_aging_detail_lines for all
  using (true)
  with check (true);
