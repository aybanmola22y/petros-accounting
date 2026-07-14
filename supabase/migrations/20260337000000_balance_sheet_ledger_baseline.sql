-- Ledger per-account balances captured when a QuickBooks Balance Sheet is imported.

create table if not exists public.balance_sheet_ledger_baseline_rows (
  id uuid primary key default gen_random_uuid(),
  account_name text not null,
  section text not null,
  group_path text not null default '',
  amount numeric not null default 0,
  period_label text,
  sort_order integer not null default 0,
  captured_at timestamptz not null default now()
);

create index if not exists idx_balance_sheet_ledger_baseline_rows_sort
  on public.balance_sheet_ledger_baseline_rows (sort_order);

alter table public.balance_sheet_ledger_baseline_rows enable row level security;

drop policy if exists "Allow read balance_sheet_ledger_baseline_rows" on public.balance_sheet_ledger_baseline_rows;
create policy "Allow read balance_sheet_ledger_baseline_rows"
  on public.balance_sheet_ledger_baseline_rows for select
  using (true);

drop policy if exists "Allow write balance_sheet_ledger_baseline_rows service" on public.balance_sheet_ledger_baseline_rows;
create policy "Allow write balance_sheet_ledger_baseline_rows service"
  on public.balance_sheet_ledger_baseline_rows for all
  using (true)
  with check (true);
