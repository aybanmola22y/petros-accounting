-- Chart of accounts (QuickBooks export: Account number, Account name, Account type, Detail type)

create table if not exists public.chart_of_accounts (
  id uuid primary key default gen_random_uuid(),
  account_number text,
  account_name text not null,
  account_type text not null,
  detail_type text not null,
  currency text not null default 'PHP',
  tax text not null default '',
  ledger_balance numeric(18, 2) not null default 0,
  bank_balance numeric(18, 2),
  bank_connected boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chart_of_accounts_account_name_key unique (account_name)
);

create index if not exists idx_chart_of_accounts_account_type
  on public.chart_of_accounts (account_type);

create index if not exists idx_chart_of_accounts_sort_order
  on public.chart_of_accounts (sort_order);

create index if not exists idx_chart_of_accounts_is_active
  on public.chart_of_accounts (is_active);

create or replace function public.set_chart_of_accounts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_chart_of_accounts_updated_at on public.chart_of_accounts;

create trigger trg_chart_of_accounts_updated_at
before update on public.chart_of_accounts
for each row
execute function public.set_chart_of_accounts_updated_at();

alter table public.chart_of_accounts enable row level security;

drop policy if exists "Allow read chart_of_accounts" on public.chart_of_accounts;
create policy "Allow read chart_of_accounts"
  on public.chart_of_accounts for select
  using (true);

drop policy if exists "Allow write chart_of_accounts service" on public.chart_of_accounts;
create policy "Allow write chart_of_accounts service"
  on public.chart_of_accounts for all
  using (true)
  with check (true);
