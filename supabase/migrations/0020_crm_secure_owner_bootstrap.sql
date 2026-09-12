-- KRUG 0.10.3 — never expose the legacy demo owner password in production.
-- The existing Mini App admin key is the one-time recovery/bootstrap authority.

update public.crm_staff_users
set password_hash=extensions.crypt(gen_random_uuid()::text || gen_random_uuid()::text,extensions.gen_salt('bf',11)),
    must_change_password=true,
    updated_at=now()
where user_id in ('u1','u2') and must_change_password=true;

delete from public.crm_staff_sessions where user_id in ('u1','u2');

create or replace function public.krug_crm_bootstrap_owner(p_admin_token text, p_login text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare v_user public.crm_staff_users%rowtype;
begin
  if not private.krug_admin_token_valid(p_admin_token) then raise exception 'ADMIN_UNAUTHORIZED' using errcode='P0001'; end if;
  if length(trim(coalesce(p_login,'')))<3 or length(p_login)>120 then raise exception 'CRM_STAFF_INVALID' using errcode='P0001'; end if;
  if length(coalesce(p_password,''))<10 or length(p_password)>200 then raise exception 'CRM_PASSWORD_WEAK' using errcode='P0001'; end if;
  if exists(select 1 from public.crm_staff_users where user_id<>'u1' and lower(login)=lower(trim(p_login))) then raise exception 'CRM_LOGIN_EXISTS' using errcode='P0001'; end if;
  update public.crm_staff_users
  set login=trim(p_login),
      password_hash=extensions.crypt(p_password,extensions.gen_salt('bf',11)),
      name='AE XL',role='owner',active=true,must_change_password=false,updated_at=now()
  where user_id='u1'
  returning * into v_user;
  if not found then raise exception 'CRM_STAFF_NOT_FOUND' using errcode='P0001'; end if;
  delete from public.crm_staff_sessions where user_id=v_user.user_id;
  return jsonb_build_object('id',v_user.user_id,'name',v_user.name,'login',v_user.login,'role',v_user.role,'active',v_user.active,'mustChangePassword',false);
end;
$$;

revoke all on function public.krug_crm_bootstrap_owner(text,text,text) from public,anon,authenticated;
grant execute on function public.krug_crm_bootstrap_owner(text,text,text) to service_role;
