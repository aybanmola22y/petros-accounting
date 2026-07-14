-- Suppliers (QuickBooks Suppliers.xls export:
-- Supplier, Company name, Street Address, City, State, Country, Zip,
-- Phone, Email, Currency, Attachments, Open Balance)

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  supplier_name text not null,
  company_name text,
  street_address text,
  city text,
  state text,
  country text,
  zip text,
  phone text,
  email text,
  currency text not null default 'Philippine Peso',
  attachment_count integer not null default 0,
  open_balance numeric(18, 2) not null default 0,
  sort_order integer not null default 0,
  source_row_number integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_suppliers_supplier_name_lower
  on public.suppliers (lower(supplier_name));

create index if not exists idx_suppliers_sort_order
  on public.suppliers (sort_order);

create index if not exists idx_suppliers_open_balance
  on public.suppliers (open_balance desc)
  where open_balance <> 0;

create or replace function public.set_suppliers_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_suppliers_updated_at on public.suppliers;

create trigger trg_suppliers_updated_at
before update on public.suppliers
for each row
execute function public.set_suppliers_updated_at();

alter table public.suppliers enable row level security;

drop policy if exists "Allow read suppliers" on public.suppliers;
create policy "Allow read suppliers"
  on public.suppliers for select
  using (true);

drop policy if exists "Allow write suppliers service" on public.suppliers;
create policy "Allow write suppliers service"
  on public.suppliers for all
  using (true)
  with check (true);
