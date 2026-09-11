-- KRUG 0.4 core database. CRM and Mini App will access it only through the server API.
-- Safe default: RLS is enabled and no public policies are created.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint unique,
  name text not null check (char_length(trim(name)) between 1 and 120),
  phone text,
  telegram_username text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.services (
  id text primary key,
  name text not null,
  public_name text,
  description text,
  public_description text,
  pricing_type text not null check (pricing_type in ('hourly', 'fixed', 'minimum')),
  public_category text not null default 'primary',
  public_visible boolean not null default true,
  active boolean not null default true,
  legacy_only boolean not null default false,
  select_duration boolean not null default true,
  min_duration_hours numeric(5,2),
  default_duration_hours numeric(5,2),
  fixed_start time,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (min_duration_hours is null or min_duration_hours > 0),
  check (default_duration_hours is null or default_duration_hours > 0)
);

create table if not exists public.service_price_tiers (
  id uuid primary key default gen_random_uuid(),
  service_id text not null references public.services(id) on delete cascade,
  period_key text not null default 'regular',
  duration_hours numeric(5,2) not null check (duration_hours > 0),
  total_price_rub integer not null check (total_price_rub >= 0),
  starts_at time,
  ends_at time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_id, period_key, duration_hours),
  check ((starts_at is null and ends_at is null) or (starts_at is not null and ends_at is not null))
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null default gen_random_uuid() unique,
  client_id uuid not null references public.clients(id) on delete restrict,
  service_id text not null references public.services(id) on delete restrict,
  service_name_snapshot text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'request' check (status in ('request', 'confirmed', 'in_progress', 'completed', 'cancelled')),
  price_rub integer not null check (price_rub >= 0),
  price_snapshot jsonb not null default '{}'::jsonb,
  bonus_reserved integer not null default 0 check (bonus_reserved >= 0),
  bonus_spent integer not null default 0 check (bonus_spent >= 0),
  amount_due_rub integer not null default 0 check (amount_due_rub >= 0),
  comment text not null default '' check (char_length(comment) <= 1000),
  cancelled_at timestamptz,
  cancelled_after_start boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

-- One physical studio = one shared resource. Active sessions may never overlap.
alter table public.bookings
  drop constraint if exists bookings_no_active_overlap;
alter table public.bookings
  add constraint bookings_no_active_overlap
  exclude using gist (tstzrange(starts_at, ends_at, '[)') with &&)
  where (status in ('request', 'confirmed', 'in_progress'));

create index if not exists bookings_client_starts_at_idx on public.bookings (client_id, starts_at desc);
create index if not exists bookings_status_starts_at_idx on public.bookings (status, starts_at);
create index if not exists service_price_tiers_service_idx on public.service_price_tiers (service_id, period_key, duration_hours);

create trigger clients_set_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

create trigger services_set_updated_at
before update on public.services
for each row execute function public.set_updated_at();

create trigger service_price_tiers_set_updated_at
before update on public.service_price_tiers
for each row execute function public.set_updated_at();

create trigger bookings_set_updated_at
before update on public.bookings
for each row execute function public.set_updated_at();

alter table public.clients enable row level security;
alter table public.services enable row level security;
alter table public.service_price_tiers enable row level security;
alter table public.bookings enable row level security;

comment on table public.services is 'Single source of truth for CRM and Mini App service catalog.';
comment on table public.bookings is 'One-room booking ledger. Overlap is rejected by PostgreSQL for active statuses.';
