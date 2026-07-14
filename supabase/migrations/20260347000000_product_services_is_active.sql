-- Active/inactive flag for products & services (QuickBooks "Make inactive").

alter table public.product_services
  add column if not exists is_active boolean not null default true;

create index if not exists idx_product_services_is_active
  on public.product_services (is_active);
