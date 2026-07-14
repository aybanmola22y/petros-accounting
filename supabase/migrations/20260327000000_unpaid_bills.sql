-- Unpaid bills (QuickBooks Unpaid Bills.xls export:
-- Supplier, Due Date, amount, balance, Status)

create table if not exists public.unpaid_bills (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.suppliers (id) on delete set null,
  supplier_name text not null,
  due_date date not null,
  bill_amount numeric(18, 2) not null,
  open_balance numeric(18, 2) not null,
  status text not null,
  sort_order integer not null default 0,
  source_row_number integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_unpaid_bills_due_date
  on public.unpaid_bills (due_date);

create index if not exists idx_unpaid_bills_supplier_id
  on public.unpaid_bills (supplier_id);

create index if not exists idx_unpaid_bills_supplier_name_lower
  on public.unpaid_bills (lower(supplier_name));

create index if not exists idx_unpaid_bills_status
  on public.unpaid_bills (status);

create index if not exists idx_unpaid_bills_open_balance
  on public.unpaid_bills (open_balance desc)
  where open_balance <> 0;

create index if not exists idx_unpaid_bills_sort_order
  on public.unpaid_bills (sort_order);

create or replace function public.set_unpaid_bills_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_unpaid_bills_updated_at on public.unpaid_bills;

create trigger trg_unpaid_bills_updated_at
before update on public.unpaid_bills
for each row
execute function public.set_unpaid_bills_updated_at();

alter table public.unpaid_bills enable row level security;

drop policy if exists "Allow read unpaid_bills" on public.unpaid_bills;
create policy "Allow read unpaid_bills"
  on public.unpaid_bills for select
  using (true);

drop policy if exists "Allow write unpaid_bills service" on public.unpaid_bills;
create policy "Allow write unpaid_bills service"
  on public.unpaid_bills for all
  using (true)
  with check (true);
