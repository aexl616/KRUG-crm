-- KRUG 0.4.4 app client directory, loyalty ledger, merge candidates and admin credential foundation.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

drop index if exists public.clients_phone_normalized_uq;
create index if not exists clients_phone_normalized_idx on public.clients (phone_normalized);

alter table public.clients
  add column if not exists name_normalized text,
  add column if not exists registered_in_app boolean not null default false,
  add column if not exists manual_origin boolean not null default false,
  add column if not exists other_origin boolean not null default false,
  add column if not exists app_registered_at timestamptz,
  add column if not exists first_studio_visit_at timestamptz,
  add column if not exists is_banned boolean not null default false,
  add column if not exists banned_at timestamptz,
  add column if not exists ban_reason text,
  add column if not exists merged_into_client_id uuid references public.clients(id) on delete restrict,
  add column if not exists legacy_crm_id text;

create unique index if not exists clients_legacy_crm_id_uq
  on public.clients (legacy_crm_id)
  where legacy_crm_id is not null and merged_into_client_id is null;
create index if not exists clients_name_normalized_idx on public.clients (name_normalized);
create index if not exists clients_app_category_idx on public.clients (registered_in_app, first_studio_visit_at) where merged_into_client_id is null;
create index if not exists clients_banned_tg_idx on public.clients (telegram_user_id) where is_banned = true and merged_into_client_id is null;

create or replace function public.krug_normalize_client_name(p_name text)
returns text language sql immutable set search_path = public, pg_temp
as $$ select lower(regexp_replace(trim(coalesce(p_name,'')), '\s+', ' ', 'g')); $$;
revoke all on function public.krug_normalize_client_name(text) from public, anon, authenticated;

create or replace function public.krug_set_client_identity_fields()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$ begin new.name_normalized := public.krug_normalize_client_name(new.name); return new; end; $$;
revoke all on function public.krug_set_client_identity_fields() from public, anon, authenticated;

drop trigger if exists clients_identity_fields on public.clients;
create trigger clients_identity_fields before insert or update of name on public.clients
for each row execute function public.krug_set_client_identity_fields();

update public.clients
set name_normalized = public.krug_normalize_client_name(name),
    registered_in_app = registered_in_app or telegram_user_id is not null,
    app_registered_at = case when telegram_user_id is not null then coalesce(app_registered_at, created_at) else app_registered_at end,
    other_origin = case when telegram_user_id is null and manual_origin = false then true else other_origin end
where name_normalized is null or (telegram_user_id is not null and registered_in_app = false);

create table if not exists public.loyalty_settings (
  singleton boolean primary key default true check (singleton),
  accrual_percent numeric(5,2) not null default 5.00 check (accrual_percent between 0 and 100),
  rubles_per_point integer not null default 1 check (rubles_per_point > 0),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.loyalty_settings(singleton) values (true) on conflict (singleton) do nothing;
create or replace trigger loyalty_settings_set_updated_at before update on public.loyalty_settings
for each row execute function public.set_updated_at();

create table if not exists public.loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  booking_id uuid references public.bookings(id) on delete set null,
  amount_points integer not null check (amount_points <> 0),
  kind text not null check (kind in ('manual_accrual','manual_writeoff','booking_accrual','booking_spend','booking_refund','adjustment')),
  reason text not null default '' check (char_length(reason) <= 500),
  created_by text not null default 'system' check (char_length(created_by) <= 120),
  created_at timestamptz not null default now()
);
create index if not exists loyalty_transactions_client_created_idx on public.loyalty_transactions (client_id, created_at desc);
create index if not exists loyalty_transactions_booking_idx on public.loyalty_transactions (booking_id) where booking_id is not null;

create table if not exists public.client_merge_candidates (
  id uuid primary key default gen_random_uuid(),
  app_client_id uuid not null references public.clients(id) on delete cascade,
  external_client_id uuid not null references public.clients(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','merged','dismissed')),
  matched_name boolean not null default true,
  matched_phone boolean not null default true,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique(app_client_id, external_client_id),
  check (app_client_id <> external_client_id)
);
create index if not exists client_merge_candidates_pending_idx on public.client_merge_candidates (status, created_at desc);

create table if not exists public.client_merge_log (
  id uuid primary key default gen_random_uuid(),
  primary_client_id uuid not null references public.clients(id) on delete restrict,
  merged_client_id uuid not null references public.clients(id) on delete restrict,
  candidate_id uuid references public.client_merge_candidates(id) on delete set null,
  primary_snapshot jsonb not null,
  merged_snapshot jsonb not null,
  merged_at timestamptz not null default now(),
  merged_by text not null default 'crm'
);

alter table public.loyalty_settings enable row level security;
alter table public.loyalty_transactions enable row level security;
alter table public.client_merge_candidates enable row level security;
alter table public.client_merge_log enable row level security;
revoke all on public.loyalty_settings, public.loyalty_transactions, public.client_merge_candidates, public.client_merge_log from anon, authenticated;

create table if not exists private.krug_admin_credentials (
  singleton boolean primary key default true check (singleton),
  token_sha256 text not null,
  rotated_at timestamptz not null default now()
);
insert into private.krug_admin_credentials(singleton, token_sha256)
values (true, 'c2704a0611bf425ca39ea0261711180e4fc6e8d1a4852aef31ad554b8e44f375')
on conflict (singleton) do update set token_sha256 = excluded.token_sha256, rotated_at = now();

create or replace function private.krug_admin_token_valid(p_token text)
returns boolean language sql stable security definer set search_path = private, extensions, pg_temp
as $$
  select exists (
    select 1 from private.krug_admin_credentials
    where singleton = true
      and token_sha256 = encode(extensions.digest(coalesce(p_token,''), 'sha256'), 'hex')
  );
$$;
revoke all on function private.krug_admin_token_valid(text) from public, anon, authenticated;

create or replace function public.krug_loyalty_balance(p_client_id uuid)
returns integer language sql stable security definer set search_path = public, pg_temp
as $$ select coalesce(sum(amount_points),0)::integer from public.loyalty_transactions where client_id = p_client_id; $$;
revoke all on function public.krug_loyalty_balance(uuid) from public, anon, authenticated;

create or replace function private.krug_refresh_merge_candidates(p_app_client_id uuid)
returns void language plpgsql security definer set search_path = public, private, pg_temp
as $$
begin
  insert into public.client_merge_candidates(app_client_id, external_client_id, matched_name, matched_phone)
  select a.id, e.id, true, true
  from public.clients a
  join public.clients e on e.id <> a.id
  where a.id = p_app_client_id
    and a.registered_in_app = true and a.merged_into_client_id is null
    and e.registered_in_app = false and e.merged_into_client_id is null
    and char_length(coalesce(a.phone_normalized,'')) between 7 and 15
    and a.phone_normalized = e.phone_normalized
    and char_length(coalesce(a.name_normalized,'')) > 0
    and a.name_normalized = e.name_normalized
  on conflict (app_client_id, external_client_id) do update
  set status = case when public.client_merge_candidates.status = 'merged' then 'merged' else 'pending' end,
      resolved_at = case when public.client_merge_candidates.status = 'merged' then public.client_merge_candidates.resolved_at else null end;
end;
$$;
revoke all on function private.krug_refresh_merge_candidates(uuid) from public, anon, authenticated;

create or replace function public.krug_mark_client_visit()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.status = 'completed' and (old.status is distinct from 'completed') then
    update public.clients set first_studio_visit_at = coalesce(first_studio_visit_at, new.ends_at)
    where id = new.client_id and merged_into_client_id is null;
  end if;
  return new;
end;
$$;
revoke all on function public.krug_mark_client_visit() from public, anon, authenticated;
drop trigger if exists bookings_mark_client_visit on public.bookings;
create trigger bookings_mark_client_visit after update of status on public.bookings
for each row execute function public.krug_mark_client_visit();