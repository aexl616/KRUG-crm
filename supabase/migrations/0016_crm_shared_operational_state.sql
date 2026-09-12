-- KRUG 0.10 — shared server-backed operational state for the CRM.
-- This deliberately excludes users/passwords/settings and stores only operational collections.

create table if not exists public.crm_shared_state (
  singleton boolean primary key default true check (singleton),
  version bigint not null default 0 check (version >= 0),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text not null default 'crm'
);

insert into public.crm_shared_state(singleton) values (true) on conflict (singleton) do nothing;
alter table public.crm_shared_state enable row level security;
revoke all on public.crm_shared_state from public, anon, authenticated;

create or replace function public.krug_crm_state_get(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare v_row public.crm_shared_state%rowtype;
begin
  if not private.krug_admin_token_valid(p_token) then raise exception 'ADMIN_UNAUTHORIZED' using errcode='P0001'; end if;
  select * into v_row from public.crm_shared_state where singleton=true;
  return jsonb_build_object('version',v_row.version,'data',v_row.data,'updatedAt',v_row.updated_at,'updatedBy',v_row.updated_by);
end;
$$;

create or replace function public.krug_crm_state_put(p_token text, p_expected_version bigint, p_data jsonb, p_updated_by text default 'crm')
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_row public.crm_shared_state%rowtype;
  v_data jsonb;
  v_by text := left(trim(coalesce(p_updated_by,'crm')),120);
begin
  if not private.krug_admin_token_valid(p_token) then raise exception 'ADMIN_UNAUTHORIZED' using errcode='P0001'; end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'INVALID_CRM_STATE' using errcode='P0001'; end if;
  if jsonb_typeof(coalesce(p_data->'clients','[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_data->'bookings','[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_data->'payments','[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_data->'expenses','[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_data->'payouts','[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_data->'studioBlocks','[]'::jsonb)) <> 'array' then
    raise exception 'INVALID_CRM_STATE' using errcode='P0001';
  end if;

  v_data := jsonb_build_object(
    'clients',coalesce(p_data->'clients','[]'::jsonb),
    'bookings',coalesce(p_data->'bookings','[]'::jsonb),
    'payments',coalesce(p_data->'payments','[]'::jsonb),
    'expenses',coalesce(p_data->'expenses','[]'::jsonb),
    'payouts',coalesce(p_data->'payouts','[]'::jsonb),
    'studioBlocks',coalesce(p_data->'studioBlocks','[]'::jsonb)
  );
  if pg_column_size(v_data) > 4000000 then raise exception 'CRM_STATE_TOO_LARGE' using errcode='P0001'; end if;

  select * into v_row from public.crm_shared_state where singleton=true for update;
  if v_row.version <> coalesce(p_expected_version,0) then
    raise exception 'CRM_STATE_CONFLICT:%', v_row.version using errcode='P0001';
  end if;

  update public.crm_shared_state
  set version=version+1, data=v_data, updated_at=now(), updated_by=case when v_by='' then 'crm' else v_by end
  where singleton=true
  returning * into v_row;

  return jsonb_build_object('version',v_row.version,'data',v_row.data,'updatedAt',v_row.updated_at,'updatedBy',v_row.updated_by);
end;
$$;

revoke all on function public.krug_crm_state_get(text) from public, anon, authenticated;
revoke all on function public.krug_crm_state_put(text,bigint,jsonb,text) from public, anon, authenticated;
grant execute on function public.krug_crm_state_get(text) to service_role;
grant execute on function public.krug_crm_state_put(text,bigint,jsonb,text) to service_role;
