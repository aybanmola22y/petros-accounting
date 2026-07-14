-- Location is not stored on sales_transactions when that relation is a view.
-- Match QuickBooks AR Ageing Detail locations by invoice/payment reference number.

create table if not exists public.sales_transaction_locations (
  reference_number text primary key,
  location text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sales_transaction_locations_location
  on public.sales_transaction_locations (location);

create or replace function public.set_sales_transaction_locations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_sales_transaction_locations_updated_at
  on public.sales_transaction_locations;

create trigger trg_sales_transaction_locations_updated_at
before update on public.sales_transaction_locations
for each row
execute function public.set_sales_transaction_locations_updated_at();

alter table public.sales_transaction_locations enable row level security;

drop policy if exists "Allow read sales_transaction_locations" on public.sales_transaction_locations;
create policy "Allow read sales_transaction_locations"
  on public.sales_transaction_locations for select
  using (true);

drop policy if exists "Allow write sales_transaction_locations service" on public.sales_transaction_locations;
create policy "Allow write sales_transaction_locations service"
  on public.sales_transaction_locations for all
  using (true)
  with check (true);
