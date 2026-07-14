-- Ledger per-account totals captured when a QuickBooks P&L is imported.
-- Used to apply deltas from new in-app transactions on top of the imported snapshot.

create table if not exists public.profit_loss_ledger_baseline_rows (
  id uuid primary key default gen_random_uuid(),
  account_name text not null,
  section text not null,
  amount numeric not null default 0,
  period_label text,
  sort_order integer not null default 0,
  captured_at timestamptz not null default now()
);

create index if not exists idx_profit_loss_ledger_baseline_rows_sort
  on public.profit_loss_ledger_baseline_rows (sort_order);

alter table public.profit_loss_ledger_baseline_rows enable row level security;

drop policy if exists "Allow read profit_loss_ledger_baseline_rows" on public.profit_loss_ledger_baseline_rows;
create policy "Allow read profit_loss_ledger_baseline_rows"
  on public.profit_loss_ledger_baseline_rows for select
  using (true);

drop policy if exists "Allow write profit_loss_ledger_baseline_rows service" on public.profit_loss_ledger_baseline_rows;
create policy "Allow write profit_loss_ledger_baseline_rows service"
  on public.profit_loss_ledger_baseline_rows for all
  using (true)
  with check (true);
