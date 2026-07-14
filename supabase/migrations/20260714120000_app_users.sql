-- Application users for login tracking and team management.
-- Separate from Supabase Auth (auth.users); used by PetroBook credentials.

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null,
  role text not null default 'Viewer',
  status text not null default 'Active',
  password_hash text,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_users_email_unique unique (email),
  constraint app_users_role_check check (
    role in ('Super Admin', 'Accountant', 'Bookkeeper', 'Viewer')
  ),
  constraint app_users_status_check check (
    status in ('Active', 'Invited', 'Disabled')
  )
);

create index if not exists idx_app_users_email_lower
  on public.app_users (lower(email));

create index if not exists idx_app_users_status
  on public.app_users (status);

alter table public.app_users enable row level security;

drop policy if exists "Allow read app_users" on public.app_users;
create policy "Allow read app_users"
  on public.app_users for select
  using (true);

drop policy if exists "Allow write app_users service" on public.app_users;
create policy "Allow write app_users service"
  on public.app_users for all
  using (true)
  with check (true);

-- Seed demo Super Admin (password: demo123). Safe to re-run.
insert into public.app_users (email, name, role, status, password_hash)
values (
  'admin@petrosphere.com',
  'John Aivanne Molato',
  'Super Admin',
  'Active',
  'scrypt$43c2ec319ac4a2cdc45ebbc7ee7d47f4$474dd6451feab1d87643e9ae249f1ee86a653f2cfaecae703382151b87eca0c2ea9fb1163292cb334144388654266e1a06b6388ed3aca38ed7fa2c39a45d34ac'
)
on conflict (email) do nothing;
