-- Customers (QuickBooks Customers.xls export from Customer Hub → Customers & leads:
-- Name, Company name, Street Address, City, State, Country, Zip,
-- Phone, Email, Attachments, Open balance)
--
-- Leads (QuickBooks Customer Hub → Customers & leads → Leads tab export;
-- typical columns: Name, Company name, Phone, Email, Lead source, address fields)

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
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

create unique index if not exists idx_customers_customer_name_lower
  on public.customers (lower(customer_name));

create index if not exists idx_customers_sort_order
  on public.customers (sort_order);

create index if not exists idx_customers_open_balance
  on public.customers (open_balance desc)
  where open_balance <> 0;

create index if not exists idx_customers_email_lower
  on public.customers (lower(email))
  where email is not null and trim(email) <> '';

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  lead_name text not null,
  company_name text,
  street_address text,
  city text,
  state text,
  country text,
  zip text,
  phone text,
  email text,
  lead_source text,
  attachment_count integer not null default 0,
  status text not null default 'open',
  converted_customer_id uuid references public.customers (id) on delete set null,
  sort_order integer not null default 0,
  source_row_number integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_leads_lead_name_lower
  on public.leads (lower(lead_name));

create index if not exists idx_leads_sort_order
  on public.leads (sort_order);

create index if not exists idx_leads_lead_source
  on public.leads (lead_source)
  where lead_source is not null and trim(lead_source) <> '';

create index if not exists idx_leads_status
  on public.leads (status);

create index if not exists idx_leads_converted_customer_id
  on public.leads (converted_customer_id)
  where converted_customer_id is not null;

create or replace function public.set_customers_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_leads_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_customers_updated_at on public.customers;
create trigger trg_customers_updated_at
before update on public.customers
for each row
execute function public.set_customers_updated_at();

drop trigger if exists trg_leads_updated_at on public.leads;
create trigger trg_leads_updated_at
before update on public.leads
for each row
execute function public.set_leads_updated_at();

alter table public.customers enable row level security;
alter table public.leads enable row level security;

drop policy if exists "Allow read customers" on public.customers;
create policy "Allow read customers"
  on public.customers for select
  using (true);

drop policy if exists "Allow write customers service" on public.customers;
create policy "Allow write customers service"
  on public.customers for all
  using (true)
  with check (true);

drop policy if exists "Allow read leads" on public.leads;
create policy "Allow read leads"
  on public.leads for select
  using (true);

drop policy if exists "Allow write leads service" on public.leads;
create policy "Allow write leads service"
  on public.leads for all
  using (true)
  with check (true);
