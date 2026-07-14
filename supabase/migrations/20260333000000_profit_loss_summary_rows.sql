-- QuickBooks Profit and Loss snapshot (account totals by section).

create table if not exists public.profit_loss_summary_rows (
  id uuid primary key default gen_random_uuid(),
  account_name text not null,
  section text not null,
  amount numeric not null default 0,
  period_label text,
  sort_order integer not null default 0,
  imported_at timestamptz not null default now()
);

create index if not exists idx_profit_loss_summary_rows_sort
  on public.profit_loss_summary_rows (sort_order);

create index if not exists idx_profit_loss_summary_rows_section
  on public.profit_loss_summary_rows (section);

alter table public.profit_loss_summary_rows enable row level security;

drop policy if exists "Allow read profit_loss_summary_rows" on public.profit_loss_summary_rows;
create policy "Allow read profit_loss_summary_rows"
  on public.profit_loss_summary_rows for select
  using (true);

drop policy if exists "Allow write profit_loss_summary_rows service" on public.profit_loss_summary_rows;
create policy "Allow write profit_loss_summary_rows service"
  on public.profit_loss_summary_rows for all
  using (true)
  with check (true);
