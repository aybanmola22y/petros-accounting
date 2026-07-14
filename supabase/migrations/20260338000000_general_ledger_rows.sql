-- QuickBooks General Ledger import: per-account transaction history (register lines).

create table if not exists public.general_ledger_rows (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.chart_of_accounts(id) on delete set null,
  account_label text not null,
  account_name text not null default '',
  account_number text not null default '',
  txn_date date,
  raw_date text,
  transaction_type text not null default '',
  ref_number text not null default '',
  payee_name text not null default '',
  description text not null default '',
  split_account text not null default '',
  amount numeric not null default 0,
  balance numeric not null default 0,
  sort_order integer not null default 0,
  period_label text,
  imported_at timestamptz not null default now()
);

create index if not exists idx_general_ledger_rows_account
  on public.general_ledger_rows (account_id, sort_order);

create index if not exists idx_general_ledger_rows_label
  on public.general_ledger_rows (account_label);

create index if not exists idx_general_ledger_rows_sort
  on public.general_ledger_rows (sort_order);

alter table public.general_ledger_rows enable row level security;

drop policy if exists "Allow read general_ledger_rows" on public.general_ledger_rows;
create policy "Allow read general_ledger_rows"
  on public.general_ledger_rows for select
  using (true);

drop policy if exists "Allow write general_ledger_rows service" on public.general_ledger_rows;
create policy "Allow write general_ledger_rows service"
  on public.general_ledger_rows for all
  using (true)
  with check (true);
