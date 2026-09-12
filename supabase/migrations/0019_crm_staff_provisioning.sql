-- KRUG 0.10.3 — owner/admin employee provisioning for server-authenticated CRM.

create or replace function private.krug_crm_assert_staff_manager(p_token uuid)
returns public.crm_staff_users
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare v_user public.crm_staff_users%rowtype;
begin
  v_user := private.krug_crm_session_user(p_token);
  if v_user.role not in ('owner','admin') then raise exception 'CRM_FORBIDDEN' using errcode='P0001'; end if;
  return v_user;
end;
$$;

create or replace function public.krug_crm_staff_list(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare v_actor public.crm_staff_users%rowtype; v_rows jsonb;
begin
  v_actor := private.krug_crm_assert_staff_manager(p_token);
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',u.user_id,'name',u.name,'login',u.login,'role',u.role,'active',u.active,
    'mustChangePassword',u.must_change_password,'createdAt',u.created_at,'updatedAt',u.updated_at
  ) order by case u.role when 'owner' then 0 when 'admin' then 1 when 'engineer' then 2 else 3 end, lower(u.name)),'[]'::jsonb)
  into v_rows from public.crm_staff_users u;
  return v_rows;
end;
$$;

create or replace function public.krug_crm_staff_create(
  p_token uuid, p_login text, p_password text, p_name text, p_role text default 'staff'
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare v_actor public.crm_staff_users%rowtype; v_user public.crm_staff_users%rowtype; v_role text := lower(trim(coalesce(p_role,'staff'))); v_id text := gen_random_uuid()::text;
begin
  v_actor := private.krug_crm_assert_staff_manager(p_token);
  if v_role not in ('owner','admin','engineer','staff') then raise exception 'CRM_ROLE_INVALID' using errcode='P0001'; end if;
  if v_role='owner' and v_actor.role<>'owner' then raise exception 'CRM_FORBIDDEN' using errcode='P0001'; end if;
  if length(trim(coalesce(p_name,'')))<2 or length(p_name)>120 then raise exception 'CRM_STAFF_INVALID' using errcode='P0001'; end if;
  if length(trim(coalesce(p_login,'')))<3 or length(p_login)>120 then raise exception 'CRM_STAFF_INVALID' using errcode='P0001'; end if;
  if length(coalesce(p_password,''))<10 or length(p_password)>200 then raise exception 'CRM_PASSWORD_WEAK' using errcode='P0001'; end if;
  if exists(select 1 from public.crm_staff_users where lower(login)=lower(trim(p_login))) then raise exception 'CRM_LOGIN_EXISTS' using errcode='P0001'; end if;
  insert into public.crm_staff_users(user_id,login,password_hash,name,role,active,must_change_password)
  values(v_id,trim(p_login),extensions.crypt(p_password,extensions.gen_salt('bf',11)),trim(p_name),v_role,true,true)
  returning * into v_user;
  return jsonb_build_object('id',v_user.user_id,'name',v_user.name,'login',v_user.login,'role',v_user.role,'active',v_user.active,'mustChangePassword',true);
end;
$$;

create or replace function public.krug_crm_staff_update(
  p_token uuid, p_user_id text, p_name text, p_role text, p_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare v_actor public.crm_staff_users%rowtype; v_target public.crm_staff_users%rowtype; v_role text := lower(trim(coalesce(p_role,'')));
begin
  v_actor := private.krug_crm_assert_staff_manager(p_token);
  select * into v_target from public.crm_staff_users where user_id=p_user_id for update;
  if not found then raise exception 'CRM_STAFF_NOT_FOUND' using errcode='P0001'; end if;
  if v_actor.role='admin' and (v_target.role='owner' or v_role='owner') then raise exception 'CRM_FORBIDDEN' using errcode='P0001'; end if;
  if v_role not in ('owner','admin','engineer','staff') then raise exception 'CRM_ROLE_INVALID' using errcode='P0001'; end if;
  if length(trim(coalesce(p_name,'')))<2 or length(p_name)>120 then raise exception 'CRM_STAFF_INVALID' using errcode='P0001'; end if;
  if v_target.user_id=v_actor.user_id and coalesce(p_active,false)=false then raise exception 'CRM_SELF_DEACTIVATE' using errcode='P0001'; end if;
  if v_target.role='owner' and (v_role<>'owner' or coalesce(p_active,false)=false)
     and not exists(select 1 from public.crm_staff_users where user_id<>v_target.user_id and role='owner' and active=true) then
    raise exception 'CRM_LAST_OWNER' using errcode='P0001';
  end if;
  update public.crm_staff_users set name=trim(p_name),role=v_role,active=coalesce(p_active,false),updated_at=now() where user_id=v_target.user_id returning * into v_target;
  if v_target.user_id<>v_actor.user_id then delete from public.crm_staff_sessions where user_id=v_target.user_id; end if;
  return jsonb_build_object('id',v_target.user_id,'name',v_target.name,'login',v_target.login,'role',v_target.role,'active',v_target.active,'mustChangePassword',v_target.must_change_password);
end;
$$;

create or replace function public.krug_crm_staff_delete(p_token uuid, p_user_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare v_actor public.crm_staff_users%rowtype; v_target public.crm_staff_users%rowtype;
begin
  v_actor := private.krug_crm_assert_staff_manager(p_token);
  select * into v_target from public.crm_staff_users where user_id=p_user_id for update;
  if not found then raise exception 'CRM_STAFF_NOT_FOUND' using errcode='P0001'; end if;
  if v_target.user_id=v_actor.user_id then raise exception 'CRM_SELF_DELETE' using errcode='P0001'; end if;
  if v_target.role='owner' then raise exception 'CRM_OWNER_DELETE' using errcode='P0001'; end if;
  if v_actor.role='admin' and v_target.role='admin' then raise exception 'CRM_FORBIDDEN' using errcode='P0001'; end if;
  delete from public.crm_staff_users where user_id=v_target.user_id;
  return jsonb_build_object('id',v_target.user_id,'deleted',true);
end;
$$;

revoke all on function private.krug_crm_assert_staff_manager(uuid) from public;
revoke all on function public.krug_crm_staff_list(uuid) from public,anon,authenticated;
revoke all on function public.krug_crm_staff_create(uuid,text,text,text,text) from public,anon,authenticated;
revoke all on function public.krug_crm_staff_update(uuid,text,text,text,boolean) from public,anon,authenticated;
revoke all on function public.krug_crm_staff_delete(uuid,text) from public,anon,authenticated;
grant execute on function public.krug_crm_staff_list(uuid) to service_role;
grant execute on function public.krug_crm_staff_create(uuid,text,text,text,text) to service_role;
grant execute on function public.krug_crm_staff_update(uuid,text,text,text,boolean) to service_role;
grant execute on function public.krug_crm_staff_delete(uuid,text) to service_role;
