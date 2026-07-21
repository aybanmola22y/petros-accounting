-- Bank register workflow: pending feed lines and status overrides for GL rows.

create table if not exists public.bank_transaction_meta (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.chart_of_accounts (id) on delete cascade,
  gl_row_id uuid references public.general_ledger_rows (id) on delete cascade,
  txn_date date,
  bank_description text not null default '',
  payee_name text not null default '',
  category_label text not null default '',
  amount numeric not null default 0,
  direction text not null default 'deposit' check (direction in ('deposit', 'payment')),
  status text not null default 'pending' check (status in ('pending', 'posted', 'excluded')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bank_transaction_meta_gl_row_unique unique (gl_row_id)
);

create index if not exists idx_bank_transaction_meta_account_status
  on public.bank_transaction_meta (account_id, status);

create index if not exists idx_bank_transaction_meta_gl_row
  on public.bank_transaction_meta (gl_row_id)
  where gl_row_id is not null;

create or replace function public.set_bank_transaction_meta_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_bank_transaction_meta_updated_at on public.bank_transaction_meta;
create trigger trg_bank_transaction_meta_updated_at
before update on public.bank_transaction_meta
for each row
execute function public.set_bank_transaction_meta_updated_at();

alter table public.bank_transaction_meta enable row level security;

drop policy if exists "Allow read bank_transaction_meta" on public.bank_transaction_meta;
create policy "Allow read bank_transaction_meta"
  on public.bank_transaction_meta for select
  using (true);

drop policy if exists "Allow write bank_transaction_meta service" on public.bank_transaction_meta;
create policy "Allow write bank_transaction_meta service"
  on public.bank_transaction_meta for all
  using (true)
  with check (true);
