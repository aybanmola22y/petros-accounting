-- Products & Services catalog (QuickBooks import + UI-created items).

create table if not exists public.product_services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  item_type text,
  sku text,
  category text,
  class_name text,
  sales_description text,
  sales_price numeric(18, 2),
  cost numeric(18, 2),
  qty_on_hand numeric(18, 2),
  reorder_point numeric(18, 2),
  bundle_lines jsonb,
  display_bundle_components boolean,
  is_custom boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_product_services_name_lower
  on public.product_services (lower(name));

create index if not exists idx_product_services_sort_order
  on public.product_services (sort_order);

create index if not exists idx_product_services_category
  on public.product_services (category)
  where category is not null and trim(category) <> '';

create or replace function public.set_product_services_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_product_services_updated_at on public.product_services;
create trigger trg_product_services_updated_at
before update on public.product_services
for each row
execute function public.set_product_services_updated_at();

alter table public.product_services enable row level security;

drop policy if exists "Allow read product_services" on public.product_services;
create policy "Allow read product_services"
  on public.product_services for select
  using (true);

drop policy if exists "Allow write product_services service" on public.product_services;
create policy "Allow write product_services service"
  on public.product_services for all
  using (true)
  with check (true);
