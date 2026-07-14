-- QuickBooks A/P Ageing Detail snapshot for Expenses Performance.

create table if not exists public.ap_aging_detail_lines (
  id uuid primary key default gen_random_uuid(),
  reference_number text not null default '',
  transaction_type text not null,
  transaction_date text,
  supplier_name text,
  location text,
  due_date text,
  past_due_days integer,
  amount numeric not null default 0,
  open_balance numeric not null default 0,
  bucket text not null,
  sort_order integer not null default 0,
  as_of text,
  total_amount numeric,
  total_open_balance numeric,
  imported_at timestamptz not null default now()
);

create index if not exists idx_ap_aging_detail_lines_bucket_sort
  on public.ap_aging_detail_lines (bucket, sort_order);

create index if not exists idx_ap_aging_detail_lines_reference_number
  on public.ap_aging_detail_lines (reference_number);

create index if not exists idx_ap_aging_detail_lines_supplier
  on public.ap_aging_detail_lines (lower(coalesce(supplier_name, '')));

alter table public.ap_aging_detail_lines enable row level security;

drop policy if exists "Allow read ap_aging_detail_lines" on public.ap_aging_detail_lines;
create policy "Allow read ap_aging_detail_lines"
  on public.ap_aging_detail_lines for select
  using (true);

drop policy if exists "Allow write ap_aging_detail_lines service" on public.ap_aging_detail_lines;
create policy "Allow write ap_aging_detail_lines service"
  on public.ap_aging_detail_lines for all
  using (true)
  with check (true);
