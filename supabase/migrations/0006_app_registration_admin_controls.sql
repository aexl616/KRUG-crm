-- KRUG 0.4.4 app registration, blocklist and token-protected CRM admin RPCs.

create table if not exists public.blocked_telegram_users (
  telegram_user_id bigint primary key check (telegram_user_id > 0),
  reason text not null default '' check (char_length(reason) <= 500),
  banned_at timestamptz not null default now(),
  active boolean not null default true
);
alter table public.blocked_telegram_users enable row level security;
revoke all on public.blocked_telegram_users from anon, authenticated;

create or replace function public.krug_register_app_client(
  p_telegram_user_id bigint,
  p_name text,
  p_phone text,
  p_telegram_username text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_client public.clients%rowtype;
  v_phone_digits text;
  v_username text;
  v_blocked boolean := false;
  v_balance integer := 0;
  v_category text;
begin
  if p_telegram_user_id is null or p_telegram_user_id <= 0 then raise exception 'INVALID_TELEGRAM_USER_ID' using errcode='P0001'; end if;
  if p_name is null or char_length(trim(p_name)) < 2 or char_length(trim(p_name)) > 80 then raise exception 'INVALID_CLIENT_NAME' using errcode='P0001'; end if;
  v_phone_digits := regexp_replace(coalesce(p_phone,''), '\D', '', 'g');
  if char_length(v_phone_digits) < 7 or char_length(v_phone_digits) > 15 then raise exception 'INVALID_CLIENT_PHONE' using errcode='P0001'; end if;
  v_username := nullif(regexp_replace(trim(coalesce(p_telegram_username,'')), '^@', ''), '');
  if v_username is not null and v_username !~ '^[A-Za-z][A-Za-z0-9_]{4,31}$' then raise exception 'INVALID_CLIENT_TELEGRAM' using errcode='P0001'; end if;

  select exists(select 1 from public.blocked_telegram_users b where b.telegram_user_id=p_telegram_user_id and b.active=true)
  into v_blocked;

  select * into v_client from public.clients
  where telegram_user_id=p_telegram_user_id and merged_into_client_id is null
  limit 1 for update;

  if v_client.id is null then
    insert into public.clients(
      telegram_user_id,name,phone,telegram_username,registered_in_app,app_registered_at,is_banned,banned_at
    ) values (
      p_telegram_user_id,trim(p_name),trim(p_phone),v_username,true,now(),v_blocked,case when v_blocked then now() else null end
    ) returning * into v_client;
  else
    update public.clients set
      name=trim(p_name),
      phone=trim(p_phone),
      telegram_username=coalesce(v_username,telegram_username),
      registered_in_app=true,
      app_registered_at=coalesce(app_registered_at,now()),
      is_banned=(is_banned or v_blocked),
      banned_at=case when (is_banned or v_blocked) then coalesce(banned_at,now()) else null end
    where id=v_client.id
    returning * into v_client;
  end if;

  perform private.krug_refresh_merge_candidates(v_client.id);
  v_balance := public.krug_loyalty_balance(v_client.id);
  v_category := case when v_client.first_studio_visit_at is null then 'app_registered' else 'app_visited' end;

  return jsonb_build_object(
    'id',v_client.id,
    'telegramUserId',v_client.telegram_user_id,
    'name',v_client.name,
    'phone',v_client.phone,
    'telegram',case when v_client.telegram_username is null then null else '@'||v_client.telegram_username end,
    'category',v_category,
    'registeredInApp',true,
    'firstStudioVisitAt',v_client.first_studio_visit_at,
    'banned',v_client.is_banned,
    'loyaltyBalance',v_balance
  );
end;
$$;
revoke all on function public.krug_register_app_client(bigint,text,text,text) from public, authenticated;
grant execute on function public.krug_register_app_client(bigint,text,text,text) to anon;

create or replace function public.krug_create_booking_v2(
  p_request_id uuid,
  p_service_id text,
  p_date date,
  p_start_time time,
  p_duration_hours numeric,
  p_client_name text,
  p_client_phone text,
  p_client_telegram text default null,
  p_telegram_user_id bigint default null,
  p_comment text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare v_profile jsonb;
begin
  if p_telegram_user_id is not null then
    v_profile := public.krug_register_app_client(p_telegram_user_id,p_client_name,p_client_phone,p_client_telegram);
    if coalesce((v_profile->>'banned')::boolean,false) then raise exception 'USER_BANNED' using errcode='P0001'; end if;
  end if;
  return public.krug_create_booking(
    p_request_id,p_service_id,p_date,p_start_time,p_duration_hours,
    p_client_name,p_client_phone,p_client_telegram,p_telegram_user_id,p_comment
  );
end;
$$;
revoke all on function public.krug_create_booking_v2(uuid,text,date,time,numeric,text,text,text,bigint,text) from public, authenticated;
grant execute on function public.krug_create_booking_v2(uuid,text,date,time,numeric,text,text,text,bigint,text) to anon;

create or replace function public.krug_admin_app_overview(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare v_settings jsonb; v_clients jsonb; v_candidates jsonb;
begin
  if not private.krug_admin_token_valid(p_token) then raise exception 'ADMIN_UNAUTHORIZED' using errcode='P0001'; end if;
  select jsonb_build_object('accrualPercent',accrual_percent,'rublesPerPoint',rubles_per_point,'enabled',enabled,'updatedAt',updated_at)
  into v_settings from public.loyalty_settings where singleton=true;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',c.id,'legacyCrmId',c.legacy_crm_id,'name',c.name,'phone',c.phone,
    'telegram',case when c.telegram_username is null then null else '@'||c.telegram_username end,
    'telegramUserId',c.telegram_user_id,'registeredInApp',c.registered_in_app,
    'manualOrigin',c.manual_origin,'otherOrigin',c.other_origin,
    'category',case when c.registered_in_app and c.first_studio_visit_at is null then 'app_registered' when c.registered_in_app then 'app_visited' else 'external' end,
    'firstStudioVisitAt',c.first_studio_visit_at,'appRegisteredAt',c.app_registered_at,
    'banned',c.is_banned,'bannedAt',c.banned_at,'banReason',c.ban_reason,
    'loyaltyBalance',public.krug_loyalty_balance(c.id),'createdAt',c.created_at,'updatedAt',c.updated_at
  ) order by c.updated_at desc),'[]'::jsonb)
  into v_clients from public.clients c where c.merged_into_client_id is null;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',m.id,'appClientId',m.app_client_id,'externalClientId',m.external_client_id,'createdAt',m.created_at,
    'app',jsonb_build_object('name',a.name,'phone',a.phone,'telegram',case when a.telegram_username is null then null else '@'||a.telegram_username end,'telegramUserId',a.telegram_user_id),
    'external',jsonb_build_object('name',e.name,'phone',e.phone,'telegram',case when e.telegram_username is null then null else '@'||e.telegram_username end,'legacyCrmId',e.legacy_crm_id)
  ) order by m.created_at desc),'[]'::jsonb)
  into v_candidates
  from public.client_merge_candidates m
  join public.clients a on a.id=m.app_client_id
  join public.clients e on e.id=m.external_client_id
  where m.status='pending' and a.merged_into_client_id is null and e.merged_into_client_id is null;
  return jsonb_build_object('settings',v_settings,'clients',v_clients,'mergeCandidates',v_candidates);
end;
$$;
revoke all on function public.krug_admin_app_overview(text) from public, authenticated;
grant execute on function public.krug_admin_app_overview(text) to anon;

create or replace function public.krug_admin_set_loyalty_policy(p_token text,p_percent numeric)
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp
as $$
declare v_row public.loyalty_settings%rowtype;
begin
  if not private.krug_admin_token_valid(p_token) then raise exception 'ADMIN_UNAUTHORIZED' using errcode='P0001'; end if;
  if p_percent is null or p_percent < 0 or p_percent > 100 then raise exception 'INVALID_PERCENT' using errcode='P0001'; end if;
  update public.loyalty_settings set accrual_percent=round(p_percent,2) where singleton=true returning * into v_row;
  return jsonb_build_object('accrualPercent',v_row.accrual_percent,'rublesPerPoint',v_row.rubles_per_point,'enabled',v_row.enabled,'updatedAt',v_row.updated_at);
end;
$$;
revoke all on function public.krug_admin_set_loyalty_policy(text,numeric) from public, authenticated;
grant execute on function public.krug_admin_set_loyalty_policy(text,numeric) to anon;

create or replace function public.krug_admin_adjust_loyalty(p_token text,p_client_id uuid,p_amount integer,p_reason text default '')
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp
as $$
declare v_balance integer; v_kind text;
begin
  if not private.krug_admin_token_valid(p_token) then raise exception 'ADMIN_UNAUTHORIZED' using errcode='P0001'; end if;
  if p_amount is null or p_amount=0 or abs(p_amount)>100000 then raise exception 'INVALID_POINTS_AMOUNT' using errcode='P0001'; end if;
  if p_reason is null or char_length(trim(p_reason))<2 or char_length(p_reason)>500 then raise exception 'INVALID_REASON' using errcode='P0001'; end if;
  if not exists(select 1 from public.clients where id=p_client_id and merged_into_client_id is null) then raise exception 'CLIENT_NOT_FOUND' using errcode='P0001'; end if;
  v_balance := public.krug_loyalty_balance(p_client_id);
  if v_balance + p_amount < 0 then raise exception 'INSUFFICIENT_POINTS' using errcode='P0001'; end if;
  v_kind := case when p_amount>0 then 'manual_accrual' else 'manual_writeoff' end;
  insert into public.loyalty_transactions(client_id,amount_points,kind,reason,created_by)
  values(p_client_id,p_amount,v_kind,trim(p_reason),'crm');
  return jsonb_build_object('clientId',p_client_id,'balance',public.krug_loyalty_balance(p_client_id));
end;
$$;
revoke all on function public.krug_admin_adjust_loyalty(text,uuid,integer,text) from public, authenticated;
grant execute on function public.krug_admin_adjust_loyalty(text,uuid,integer,text) to anon;

create or replace function public.krug_admin_set_ban(p_token text,p_telegram_user_id bigint,p_banned boolean,p_reason text default '')
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp
as $$
declare v_client public.clients%rowtype;
begin
  if not private.krug_admin_token_valid(p_token) then raise exception 'ADMIN_UNAUTHORIZED' using errcode='P0001'; end if;
  if p_telegram_user_id is null or p_telegram_user_id<=0 then raise exception 'INVALID_TELEGRAM_USER_ID' using errcode='P0001'; end if;
  if p_reason is not null and char_length(p_reason)>500 then raise exception 'INVALID_REASON' using errcode='P0001'; end if;
  if p_banned then
    insert into public.blocked_telegram_users(telegram_user_id,reason,banned_at,active)
    values(p_telegram_user_id,trim(coalesce(p_reason,'')),now(),true)
    on conflict(telegram_user_id) do update set reason=excluded.reason,banned_at=now(),active=true;
  else
    update public.blocked_telegram_users set active=false where telegram_user_id=p_telegram_user_id;
  end if;
  update public.clients set
    is_banned=p_banned,
    banned_at=case when p_banned then now() else null end,
    ban_reason=case when p_banned then nullif(trim(coalesce(p_reason,'')),'') else null end
  where telegram_user_id=p_telegram_user_id and merged_into_client_id is null
  returning * into v_client;
  return jsonb_build_object('telegramUserId',p_telegram_user_id,'banned',p_banned,'clientId',v_client.id);
end;
$$;
revoke all on function public.krug_admin_set_ban(text,bigint,boolean,text) from public, authenticated;
grant execute on function public.krug_admin_set_ban(text,bigint,boolean,text) to anon;

create or replace function public.krug_admin_import_clients(p_token text,p_clients jsonb)
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp
as $$
declare v_item jsonb; v_client public.clients%rowtype; v_count integer:=0; v_id text; v_name text; v_phone text; v_tg text; v_app uuid;
begin
  if not private.krug_admin_token_valid(p_token) then raise exception 'ADMIN_UNAUTHORIZED' using errcode='P0001'; end if;
  if p_clients is null or jsonb_typeof(p_clients)<>'array' then raise exception 'INVALID_CLIENTS' using errcode='P0001'; end if;
  if jsonb_array_length(p_clients)>1000 then raise exception 'TOO_MANY_CLIENTS' using errcode='P0001'; end if;
  for v_item in select value from jsonb_array_elements(p_clients) loop
    v_id:=nullif(trim(v_item->>'id'),''); v_name:=nullif(trim(v_item->>'name'),''); v_phone:=nullif(trim(v_item->>'phone'),'');
    v_tg:=nullif(regexp_replace(trim(coalesce(v_item->>'telegram','')),'^@',''),'');
    if v_id is null or v_name is null or char_length(v_name)>120 then continue; end if;
    select * into v_client from public.clients where legacy_crm_id=v_id and merged_into_client_id is null limit 1;
    if v_client.id is null then
      insert into public.clients(name,phone,telegram_username,manual_origin,legacy_crm_id)
      values(v_name,v_phone,v_tg,true,v_id) returning * into v_client;
    else
      update public.clients set name=v_name,phone=coalesce(v_phone,phone),telegram_username=coalesce(v_tg,telegram_username),manual_origin=true
      where id=v_client.id returning * into v_client;
    end if;
    v_count:=v_count+1;
    for v_app in select id from public.clients where registered_in_app=true and merged_into_client_id is null and id<>v_client.id
      and phone_normalized=v_client.phone_normalized and name_normalized=v_client.name_normalized
    loop perform private.krug_refresh_merge_candidates(v_app); end loop;
  end loop;
  return jsonb_build_object('imported',v_count);
end;
$$;
revoke all on function public.krug_admin_import_clients(text,jsonb) from public, authenticated;
grant execute on function public.krug_admin_import_clients(text,jsonb) to anon;

create or replace function public.krug_admin_merge_candidate(p_token text,p_candidate_id uuid)
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp
as $$
declare v_candidate public.client_merge_candidates%rowtype; v_app public.clients%rowtype; v_ext public.clients%rowtype; v_primary_snapshot jsonb; v_merged_snapshot jsonb;
begin
  if not private.krug_admin_token_valid(p_token) then raise exception 'ADMIN_UNAUTHORIZED' using errcode='P0001'; end if;
  select * into v_candidate from public.client_merge_candidates where id=p_candidate_id and status='pending' for update;
  if not found then raise exception 'MERGE_CANDIDATE_NOT_FOUND' using errcode='P0001'; end if;
  select * into v_app from public.clients where id=v_candidate.app_client_id and merged_into_client_id is null for update;
  select * into v_ext from public.clients where id=v_candidate.external_client_id and merged_into_client_id is null for update;
  if v_app.id is null or v_ext.id is null then raise exception 'MERGE_CLIENT_NOT_FOUND' using errcode='P0001'; end if;
  v_primary_snapshot:=to_jsonb(v_app); v_merged_snapshot:=to_jsonb(v_ext);
  update public.bookings set client_id=v_app.id where client_id=v_ext.id;
  update public.loyalty_transactions set client_id=v_app.id where client_id=v_ext.id;
  update public.clients set
    manual_origin=(v_app.manual_origin or v_ext.manual_origin), other_origin=(v_app.other_origin or v_ext.other_origin),
    first_studio_visit_at=case when v_app.first_studio_visit_at is null then v_ext.first_studio_visit_at when v_ext.first_studio_visit_at is null then v_app.first_studio_visit_at else least(v_app.first_studio_visit_at,v_ext.first_studio_visit_at) end,
    legacy_crm_id=coalesce(v_app.legacy_crm_id,v_ext.legacy_crm_id),
    phone=case when nullif(trim(v_app.phone),'') is null then v_ext.phone else v_app.phone end,
    telegram_username=coalesce(v_app.telegram_username,v_ext.telegram_username)
  where id=v_app.id;
  update public.clients set merged_into_client_id=v_app.id where id=v_ext.id;
  update public.client_merge_candidates set status='merged',resolved_at=now() where id=v_candidate.id;
  update public.client_merge_candidates set status='dismissed',resolved_at=now()
  where status='pending' and id<>v_candidate.id and (app_client_id=v_ext.id or external_client_id=v_ext.id or external_client_id=v_app.id);
  insert into public.client_merge_log(primary_client_id,merged_client_id,candidate_id,primary_snapshot,merged_snapshot,merged_by)
  values(v_app.id,v_ext.id,v_candidate.id,v_primary_snapshot,v_merged_snapshot,'crm');
  return jsonb_build_object('clientId',v_app.id,'mergedClientId',v_ext.id,'balance',public.krug_loyalty_balance(v_app.id));
end;
$$;
revoke all on function public.krug_admin_merge_candidate(text,uuid) from public, authenticated;
grant execute on function public.krug_admin_merge_candidate(text,uuid) to anon;

create or replace function public.krug_admin_dismiss_merge(p_token text,p_candidate_id uuid)
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp
as $$
begin
  if not private.krug_admin_token_valid(p_token) then raise exception 'ADMIN_UNAUTHORIZED' using errcode='P0001'; end if;
  update public.client_merge_candidates set status='dismissed',resolved_at=now() where id=p_candidate_id and status='pending';
  if not found then raise exception 'MERGE_CANDIDATE_NOT_FOUND' using errcode='P0001'; end if;
  return jsonb_build_object('id',p_candidate_id,'status','dismissed');
end;
$$;
revoke all on function public.krug_admin_dismiss_merge(text,uuid) from public, authenticated;
grant execute on function public.krug_admin_dismiss_merge(text,uuid) to anon;