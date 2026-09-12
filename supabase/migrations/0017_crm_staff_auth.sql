-- KRUG 0.10.2 — server-backed employee authentication and role-scoped CRM state.

create table if not exists public.crm_staff_users (
  user_id text primary key,
  login text not null unique,
  password_hash text not null,
  name text not null,
  role text not null check (role in ('owner','admin','engineer','staff')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists crm_staff_users_login_lower_idx on public.crm_staff_users(lower(login));

create table if not exists public.crm_staff_sessions (
  token uuid primary key default gen_random_uuid(),
  user_id text not null references public.crm_staff_users(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '12 hours')
);

create index if not exists crm_staff_sessions_user_idx on public.crm_staff_sessions(user_id);
create index if not exists crm_staff_sessions_expires_idx on public.crm_staff_sessions(expires_at);

alter table public.crm_staff_users enable row level security;
alter table public.crm_staff_sessions enable row level security;
revoke all on public.crm_staff_users from public, anon, authenticated;
revoke all on public.crm_staff_sessions from public, anon, authenticated;

insert into public.crm_staff_users(user_id,login,password_hash,name,role)
values
  ('u1','admin',extensions.crypt('admin123',extensions.gen_salt('bf',10)),'AE XL','owner'),
  ('u2','staff',extensions.crypt('staff123',extensions.gen_salt('bf',10)),'Сотрудник','engineer')
on conflict (user_id) do nothing;

create or replace function private.krug_crm_session_user(p_token uuid)
returns public.crm_staff_users
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare v_user public.crm_staff_users%rowtype;
begin
  select u.* into v_user
  from public.crm_staff_sessions s
  join public.crm_staff_users u on u.user_id=s.user_id
  where s.token=p_token and s.expires_at>now() and u.active=true;
  if not found then raise exception 'CRM_SESSION_INVALID' using errcode='P0001'; end if;
  return v_user;
end;
$$;

create or replace function public.krug_crm_login(p_login text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare v_user public.crm_staff_users%rowtype; v_token uuid; v_expires timestamptz;
begin
  if length(coalesce(p_login,''))>120 or length(coalesce(p_password,''))>300 then
    raise exception 'CRM_AUTH_INVALID' using errcode='P0001';
  end if;
  select * into v_user from public.crm_staff_users
  where lower(login)=lower(trim(coalesce(p_login,''))) and active=true;
  if not found or v_user.password_hash <> extensions.crypt(coalesce(p_password,''),v_user.password_hash) then
    perform pg_sleep(0.12);
    raise exception 'CRM_AUTH_INVALID' using errcode='P0001';
  end if;
  delete from public.crm_staff_sessions where expires_at<=now() or (user_id=v_user.user_id and created_at<now()-interval '30 days');
  insert into public.crm_staff_sessions(user_id) values(v_user.user_id) returning token,expires_at into v_token,v_expires;
  return jsonb_build_object(
    'token',v_token,'expiresAt',v_expires,
    'user',jsonb_build_object('id',v_user.user_id,'name',v_user.name,'login',v_user.login,'role',v_user.role)
  );
end;
$$;

create or replace function public.krug_crm_session_get(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare v_user public.crm_staff_users%rowtype; v_expires timestamptz;
begin
  v_user := private.krug_crm_session_user(p_token);
  update public.crm_staff_sessions set last_seen_at=now() where token=p_token returning expires_at into v_expires;
  return jsonb_build_object('expiresAt',v_expires,'user',jsonb_build_object('id',v_user.user_id,'name',v_user.name,'login',v_user.login,'role',v_user.role));
end;
$$;

create or replace function public.krug_crm_logout(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  delete from public.crm_staff_sessions where token=p_token;
  return true;
end;
$$;

create or replace function public.krug_crm_state_get_session(p_session uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare v_user public.crm_staff_users%rowtype; v_row public.crm_shared_state%rowtype; v_data jsonb; v_read jsonb; v_write jsonb;
begin
  v_user := private.krug_crm_session_user(p_session);
  select * into v_row from public.crm_shared_state where singleton=true;
  if v_user.role in ('owner','admin') then
    v_read := '["clients","bookings","payments","expenses","payouts","studioBlocks"]'::jsonb;
    v_write := v_read;
    v_data := v_row.data;
  elsif v_user.role='engineer' then
    v_read := '["clients","bookings","studioBlocks"]'::jsonb;
    v_write := v_read;
    v_data := jsonb_build_object(
      'clients',coalesce(v_row.data->'clients','[]'::jsonb),
      'bookings',coalesce(v_row.data->'bookings','[]'::jsonb),
      'studioBlocks',coalesce(v_row.data->'studioBlocks','[]'::jsonb)
    );
  else
    v_read := '["clients","bookings","studioBlocks"]'::jsonb;
    v_write := '[]'::jsonb;
    v_data := jsonb_build_object(
      'clients',coalesce(v_row.data->'clients','[]'::jsonb),
      'bookings',coalesce(v_row.data->'bookings','[]'::jsonb),
      'studioBlocks',coalesce(v_row.data->'studioBlocks','[]'::jsonb)
    );
  end if;
  return jsonb_build_object('version',v_row.version,'data',v_data,'updatedAt',v_row.updated_at,'updatedBy',v_row.updated_by,'permissions',jsonb_build_object('read',v_read,'write',v_write),'user',jsonb_build_object('id',v_user.user_id,'name',v_user.name,'role',v_user.role));
end;
$$;

create or replace function public.krug_crm_state_put_session(p_session uuid, p_expected_version bigint, p_data jsonb, p_updated_by text default 'crm')
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare v_user public.crm_staff_users%rowtype; v_row public.crm_shared_state%rowtype; v_data jsonb; v_by text := left(trim(coalesce(p_updated_by,'crm')),120);
begin
  v_user := private.krug_crm_session_user(p_session);
  if v_user.role='staff' then raise exception 'CRM_FORBIDDEN' using errcode='P0001'; end if;
  if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'INVALID_CRM_STATE' using errcode='P0001'; end if;
  select * into v_row from public.crm_shared_state where singleton=true for update;
  if v_row.version<>coalesce(p_expected_version,0) then raise exception 'CRM_STATE_CONFLICT:%',v_row.version using errcode='P0001'; end if;

  if v_user.role in ('owner','admin') then
    if jsonb_typeof(coalesce(p_data->'clients','[]'::jsonb))<>'array'
       or jsonb_typeof(coalesce(p_data->'bookings','[]'::jsonb))<>'array'
       or jsonb_typeof(coalesce(p_data->'payments','[]'::jsonb))<>'array'
       or jsonb_typeof(coalesce(p_data->'expenses','[]'::jsonb))<>'array'
       or jsonb_typeof(coalesce(p_data->'payouts','[]'::jsonb))<>'array'
       or jsonb_typeof(coalesce(p_data->'studioBlocks','[]'::jsonb))<>'array' then raise exception 'INVALID_CRM_STATE' using errcode='P0001'; end if;
    v_data := jsonb_build_object(
      'clients',coalesce(p_data->'clients','[]'::jsonb),'bookings',coalesce(p_data->'bookings','[]'::jsonb),
      'payments',coalesce(p_data->'payments','[]'::jsonb),'expenses',coalesce(p_data->'expenses','[]'::jsonb),
      'payouts',coalesce(p_data->'payouts','[]'::jsonb),'studioBlocks',coalesce(p_data->'studioBlocks','[]'::jsonb)
    );
  else
    if jsonb_typeof(coalesce(p_data->'clients','[]'::jsonb))<>'array'
       or jsonb_typeof(coalesce(p_data->'bookings','[]'::jsonb))<>'array'
       or jsonb_typeof(coalesce(p_data->'studioBlocks','[]'::jsonb))<>'array' then raise exception 'INVALID_CRM_STATE' using errcode='P0001'; end if;
    v_data := v_row.data || jsonb_build_object(
      'clients',coalesce(p_data->'clients',v_row.data->'clients','[]'::jsonb),
      'bookings',coalesce(p_data->'bookings',v_row.data->'bookings','[]'::jsonb),
      'studioBlocks',coalesce(p_data->'studioBlocks',v_row.data->'studioBlocks','[]'::jsonb)
    );
  end if;
  if pg_column_size(v_data)>4000000 then raise exception 'CRM_STATE_TOO_LARGE' using errcode='P0001'; end if;
  update public.crm_shared_state set version=version+1,data=v_data,updated_at=now(),updated_by=case when v_by='' then v_user.name else v_by end where singleton=true returning * into v_row;
  return public.krug_crm_state_get_session(p_session);
end;
$$;

revoke all on function private.krug_crm_session_user(uuid) from public;
revoke all on function public.krug_crm_login(text,text) from public,anon,authenticated;
revoke all on function public.krug_crm_session_get(uuid) from public,anon,authenticated;
revoke all on function public.krug_crm_logout(uuid) from public,anon,authenticated;
revoke all on function public.krug_crm_state_get_session(uuid) from public,anon,authenticated;
revoke all on function public.krug_crm_state_put_session(uuid,bigint,jsonb,text) from public,anon,authenticated;
grant execute on function public.krug_crm_login(text,text) to service_role;
grant execute on function public.krug_crm_session_get(uuid) to service_role;
grant execute on function public.krug_crm_logout(uuid) to service_role;
grant execute on function public.krug_crm_state_get_session(uuid) to service_role;
grant execute on function public.krug_crm_state_put_session(uuid,bigint,jsonb,text) to service_role;
