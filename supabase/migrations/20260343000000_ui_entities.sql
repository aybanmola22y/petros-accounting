-- UI-created invoices, product/services catalog, and recurring transaction templates.

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null,
  invoice_date date not null,
  customer_id uuid references public.customers (id) on delete set null,
  amount numeric(18, 2) not null default 0,
  balance_due numeric(18, 2) not null default 0,
  kind text not null default 'open',
  overdue_days integer,
  status_sub text,
  status_timeline jsonb,
  voided boolean not null default false,
  lines jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_invoices_customer_id on public.invoices (customer_id);
create index if not exists idx_invoices_invoice_date on public.invoices (invoice_date desc);
create index if not exists idx_invoices_kind on public.invoices (kind);
create index if not exists idx_invoices_sort_order on public.invoices (sort_order);

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

create table if not exists public.recurring_templates (
  id uuid primary key default gen_random_uuid(),
  template_name text not null,
  schedule_type text not null,
  txn_type text not null,
  interval_label text not null,
  previous_date text not null,
  next_date text not null,
  customer_supplier text not null,
  amount numeric(18, 2) not null default 0,
  location text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_recurring_templates_sort_order
  on public.recurring_templates (sort_order);

create or replace function public.set_invoices_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_product_services_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_recurring_templates_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_invoices_updated_at on public.invoices;
create trigger trg_invoices_updated_at
before update on public.invoices
for each row
execute function public.set_invoices_updated_at();

drop trigger if exists trg_product_services_updated_at on public.product_services;
create trigger trg_product_services_updated_at
before update on public.product_services
for each row
execute function public.set_product_services_updated_at();

drop trigger if exists trg_recurring_templates_updated_at on public.recurring_templates;
create trigger trg_recurring_templates_updated_at
before update on public.recurring_templates
for each row
execute function public.set_recurring_templates_updated_at();

alter table public.invoices enable row level security;
alter table public.product_services enable row level security;
alter table public.recurring_templates enable row level security;

drop policy if exists "Allow read invoices" on public.invoices;
create policy "Allow read invoices"
  on public.invoices for select
  using (true);

drop policy if exists "Allow write invoices service" on public.invoices;
create policy "Allow write invoices service"
  on public.invoices for all
  using (true)
  with check (true);

drop policy if exists "Allow read product_services" on public.product_services;
create policy "Allow read product_services"
  on public.product_services for select
  using (true);

drop policy if exists "Allow write product_services service" on public.product_services;
create policy "Allow write product_services service"
  on public.product_services for all
  using (true)
  with check (true);

drop policy if exists "Allow read recurring_templates" on public.recurring_templates;
create policy "Allow read recurring_templates"
  on public.recurring_templates for select
  using (true);

drop policy if exists "Allow write recurring_templates service" on public.recurring_templates;
create policy "Allow write recurring_templates service"
  on public.recurring_templates for all
  using (true)
  with check (true);
