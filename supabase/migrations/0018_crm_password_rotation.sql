-- KRUG 0.10.2 — legacy bootstrap passwords are temporary and must be rotated.

alter table public.crm_staff_users
  add column if not exists must_change_password boolean not null default true;

update public.crm_staff_users set must_change_password=true where user_id in ('u1','u2');

create or replace function public.krug_crm_login(p_login text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare v_user public.crm_staff_users%rowtype; v_token uuid; v_expires timestamptz;
begin
  if length(coalesce(p_login,''))>120 or length(coalesce(p_password,''))>300 then raise exception 'CRM_AUTH_INVALID' using errcode='P0001'; end if;
  select * into v_user from public.crm_staff_users where lower(login)=lower(trim(coalesce(p_login,''))) and active=true;
  if not found or v_user.password_hash <> extensions.crypt(coalesce(p_password,''),v_user.password_hash) then
    perform pg_sleep(0.12);
    raise exception 'CRM_AUTH_INVALID' using errcode='P0001';
  end if;
  delete from public.crm_staff_sessions where expires_at<=now() or (user_id=v_user.user_id and created_at<now()-interval '30 days');
  insert into public.crm_staff_sessions(user_id) values(v_user.user_id) returning token,expires_at into v_token,v_expires;
  return jsonb_build_object(
    'token',v_token,'expiresAt',v_expires,
    'user',jsonb_build_object('id',v_user.user_id,'name',v_user.name,'login',v_user.login,'role',v_user.role,'mustChangePassword',v_user.must_change_password)
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
  return jsonb_build_object('expiresAt',v_expires,'user',jsonb_build_object('id',v_user.user_id,'name',v_user.name,'login',v_user.login,'role',v_user.role,'mustChangePassword',v_user.must_change_password));
end;
$$;

create or replace function public.krug_crm_change_password(p_token uuid, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare v_user public.crm_staff_users%rowtype;
begin
  v_user := private.krug_crm_session_user(p_token);
  if length(coalesce(p_password,'')) < 10 or length(p_password) > 200 then
    raise exception 'CRM_PASSWORD_WEAK' using errcode='P0001';
  end if;
  update public.crm_staff_users
  set password_hash=extensions.crypt(p_password,extensions.gen_salt('bf',11)),must_change_password=false,updated_at=now()
  where user_id=v_user.user_id
  returning * into v_user;
  return jsonb_build_object('user',jsonb_build_object('id',v_user.user_id,'name',v_user.name,'login',v_user.login,'role',v_user.role,'mustChangePassword',false));
end;
$$;

revoke all on function public.krug_crm_change_password(uuid,text) from public,anon,authenticated;
grant execute on function public.krug_crm_change_password(uuid,text) to service_role;
