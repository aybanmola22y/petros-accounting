-- QuickBooks Balance Sheet snapshot (account balances by section/group).

create table if not exists public.balance_sheet_summary_rows (
  id uuid primary key default gen_random_uuid(),
  account_name text not null,
  section text not null,
  group_path text not null default '',
  amount numeric not null default 0,
  period_label text,
  sort_order integer not null default 0,
  imported_at timestamptz not null default now()
);

create index if not exists idx_balance_sheet_summary_rows_sort
  on public.balance_sheet_summary_rows (sort_order);

create index if not exists idx_balance_sheet_summary_rows_section
  on public.balance_sheet_summary_rows (section);

alter table public.balance_sheet_summary_rows enable row level security;

drop policy if exists "Allow read balance_sheet_summary_rows" on public.balance_sheet_summary_rows;
create policy "Allow read balance_sheet_summary_rows"
  on public.balance_sheet_summary_rows for select
  using (true);

drop policy if exists "Allow write balance_sheet_summary_rows service" on public.balance_sheet_summary_rows;
create policy "Allow write balance_sheet_summary_rows service"
  on public.balance_sheet_summary_rows for all
  using (true)
  with check (true);
