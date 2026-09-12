-- 0.11.0: server staff profiles, weekly availability and calendar-date overrides.
-- Empty/missing schedules are unavailable. Times and dates are always Moscow time.
alter table public.services add column staff_selection text not null default 'none'
  check (staff_selection in ('none','optional','required'));
update public.services set staff_selection='optional'
where id in ('recording','recording-mix','studio-mixing','studio-beatmaking','studio-mix-master');

create table public.staff_booking_profiles (
  staff_id text primary key references public.crm_staff_users(user_id) on delete cascade,
  display_name text not null default '' check (length(display_name)<=120),
  photo_url text not null default '' check (photo_url='' or (photo_url ~ '^https://' and length(photo_url)<=2000)),
  experience_since integer check (experience_since between 1950 and 2100),
  genres text not null default '' check (length(genres)<=300),
  bio text not null default '' check (length(bio)<=1000),
  published boolean not null default false,
  priority integer not null default 100,
  schedule jsonb not null default '{"weekly":{},"exceptions":{}}',
  version integer not null default 0
);
create table public.staff_service_qualifications (
  staff_id text references public.staff_booking_profiles(staff_id) on delete cascade,
  service_id text references public.services(id),
  primary key(staff_id,service_id)
);
alter table public.staff_booking_profiles enable row level security;
alter table public.staff_service_qualifications enable row level security;
revoke all on public.staff_booking_profiles, public.staff_service_qualifications from public,anon,authenticated;
alter table public.bookings add column staff_id text references public.crm_staff_users(user_id),
  add column staff_name_snapshot text;

create function private.krug_validate_schedule(p_schedule jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare layer text; day record; slot jsonb; count_days integer;
begin
  if jsonb_typeof(p_schedule) is distinct from 'object' then return false; end if;
  foreach layer in array array['weekly','exceptions'] loop
    if jsonb_typeof(p_schedule->layer) is distinct from 'object' then return false; end if;
    select count(*) into count_days from jsonb_object_keys(p_schedule->layer);
    if count_days > (case when layer='weekly' then 7 else 366 end) then return false; end if;
    for day in select * from jsonb_each(p_schedule->layer) loop
      if layer='weekly' and day.key !~ '^[1-7]$' then return false; end if;
      if layer='exceptions' then
        if day.key !~ '^\d{4}-\d{2}-\d{2}$' or to_char(day.key::date,'YYYY-MM-DD')<>day.key then return false; end if;
      end if;
      if jsonb_typeof(day.value)<>'array' or jsonb_array_length(day.value)>8 then return false; end if;
      for slot in select * from jsonb_array_elements(day.value) loop
        if jsonb_typeof(slot)<>'object' or coalesce(slot->>'start','') !~ '^([01]\d|2[0-3]):[0-5]\d$'
          or coalesce(slot->>'end','') !~ '^([01]\d|2[0-3]):[0-5]\d$' or slot->>'start'=slot->>'end' then return false; end if;
      end loop;
    end loop;
  end loop;
  return true;
exception when others then return false;
end $$;
alter table public.staff_booking_profiles add constraint staff_valid_schedule check(private.krug_validate_schedule(schedule));

-- Clip each calendar day separately: a date override also cancels spillover from yesterday.
create function private.krug_staff_on_duty(p_schedule jsonb,p_start timestamptz,p_end timestamptz)
returns boolean language sql stable set search_path='' as $$
  with days as (
    select d::date as day from generate_series((p_start at time zone 'Europe/Moscow')::date::timestamp,
      ((p_end-interval '1 microsecond') at time zone 'Europe/Moscow')::date::timestamp,interval '1 day') d
  ), sources as (
    select day,day-offset_days source_day from days cross join generate_series(0,1) offset_days
    where offset_days=0 or not (p_schedule->'exceptions' ? day::text)
  ), intervals as (
    select day,source_day,slot from sources cross join lateral jsonb_array_elements(
      coalesce(p_schedule->'exceptions'->source_day::text,
      p_schedule->'weekly'->extract(isodow from source_day)::integer::text,'[]'::jsonb)) slot
  ), bounds as (
    select greatest(day::timestamp,source_day+(slot->>'start')::time) at time zone 'Europe/Moscow' lo,
      least((day+1)::timestamp,source_day+(slot->>'end')::time+
        case when slot->>'end'<slot->>'start' then interval '1 day' else interval '0' end) at time zone 'Europe/Moscow' hi
    from intervals
  ) select p_end>p_start and coalesce((select range_agg(tstzrange(lo,hi,'[)')) @> tstzrange(p_start,p_end,'[)') from bounds where hi>lo),false);
$$;

-- CRM still stores its operational bookings in a shared JSON document.
create function private.krug_crm_interval(p_row jsonb) returns tstzrange
language plpgsql stable set search_path='' as $$
declare s timestamp; e timestamp; h numeric; duration_text text;
begin
  s := (p_row->>'date')::date + coalesce(p_row->>'time',p_row->>'startTime')::time;
  if nullif(p_row->>'endTime','') is not null then
    e := (p_row->>'date')::date+(p_row->>'endTime')::time;
    if e<=s then e:=e+interval '1 day'; end if;
  else
    h:=nullif(p_row->>'durationHours','')::numeric;
    if h is null then
      duration_text:=lower(coalesce(p_row->>'duration','1 час'));
      h:=coalesce(nullif(replace(substring(duration_text from '[0-9]+(?:[.,][0-9]+)?'),',','.'),'')::numeric,1);
      if duration_text ~ 'день|дня|дней' then h:=8;
      elsif duration_text like '%мин%' or (duration_text ~ '^\s*[0-9]+(?:[.,][0-9]+)?\s*$' and h>24) then h:=h/60; end if;
      h:=greatest(0.25,h);
    end if;
    e:=s+h*interval '1 hour';
  end if;
  if s is null or e is null or e<=s then return null; end if;
  return tstzrange(s at time zone 'Europe/Moscow',e at time zone 'Europe/Moscow','[)');
end $$;

create function private.krug_crm_busy(p_data jsonb) returns table(id text,period tstzrange)
language sql stable set search_path='' as $$
 select row->>'id',private.krug_crm_interval(row) from jsonb_array_elements(coalesce(p_data->'bookings','[]')) row
 where coalesce(row->>'source','')<>'miniapp' and coalesce(row->>'miniAppBookingId','')=''
 and lower(coalesce(row->>'status','request')) not in ('отменено','отменена','cancelled','completed','завершено','завершена')
 union all
 select row->>'id',private.krug_crm_interval(row) from jsonb_array_elements(coalesce(p_data->'studioBlocks','[]')) row
 where coalesce(row->>'active','true')<>'false' and lower(coalesce(row->>'status','')) not in ('отменено','cancelled');
$$;

create function private.krug_staff_candidates(p_service text,p_start timestamptz,p_end timestamptz)
returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',p.staff_id,'name',coalesce(nullif(p.display_name,''),u.name),
   'photoUrl',p.photo_url,'experienceSince',p.experience_since,'genres',p.genres,'bio',p.bio,'scheduled',true)
   order by p.priority,p.staff_id),'[]'::jsonb)
 from public.staff_booking_profiles p join public.crm_staff_users u on u.user_id=p.staff_id
 join public.staff_service_qualifications q on q.staff_id=p.staff_id and q.service_id=p_service
 where u.active and p.published and private.krug_staff_on_duty(p.schedule,p_start,p_end)
 and not exists(select 1 from public.bookings b where b.status in ('request','confirmed','in_progress')
   and b.starts_at<p_end and b.ends_at>p_start)
 and not exists(select 1 from public.studio_blocks b where b.active and b.starts_at<p_end and b.ends_at>p_start)
 and not exists(select 1 from public.crm_shared_state s cross join lateral private.krug_crm_busy(s.data) b
   where b.period && tstzrange(p_start,p_end,'[)'));
$$;

alter function public.krug_available_slots(date,numeric,text) rename to krug_room_slots;
revoke all on function public.krug_room_slots(date,numeric,text) from public,anon,authenticated;
create function public.krug_available_slots(p_date date,p_duration_hours numeric,p_service_id text)
returns jsonb language plpgsql stable security definer set search_path=public,private,pg_temp as $$
declare result jsonb; mode text; slot text; s timestamptz; e timestamptz;
  slots jsonb:='[]'; choices jsonb:='{}'; candidates jsonb;
begin
 result:=public.krug_room_slots(p_date,p_duration_hours,p_service_id);
 select staff_selection into mode from public.services where id=p_service_id;
 for slot in select jsonb_array_elements_text(result->'slots') loop
   s:=(p_date+slot::time) at time zone 'Europe/Moscow'; e:=s+p_duration_hours*interval '1 hour';
   if exists(select 1 from public.crm_shared_state st cross join lateral private.krug_crm_busy(st.data) b where b.period && tstzrange(s,e,'[)')) then continue; end if;
   if mode<>'none' then
     candidates:=private.krug_staff_candidates(p_service_id,s,e);
     if jsonb_array_length(candidates)=0 then continue; end if;
     choices:=choices||jsonb_build_object(slot,jsonb_build_object('staff',candidates,'defaultStaffId',candidates->0->>'id'));
   end if;
   slots:=slots||to_jsonb(slot);
 end loop;
 return result||jsonb_build_object('slots',slots,'staffSelection',coalesce(mode,'none'),'staffBySlot',choices);
end $$;
revoke all on function public.krug_available_slots(date,numeric,text) from public;
grant execute on function public.krug_available_slots(date,numeric,text) to anon,authenticated,service_role;

create function public.krug_crm_staff_schedule(p_token uuid,p_staff_id text,p_profile jsonb default null,p_expected_version integer default null)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare actor public.crm_staff_users; profile public.staff_booking_profiles; ids jsonb;
begin
 actor:=private.krug_crm_session_user(p_token);
 if actor.role not in ('owner','admin') then raise exception 'CRM_FORBIDDEN'; end if;
 if not exists(select 1 from public.crm_staff_users where user_id=p_staff_id) then raise exception 'CRM_STAFF_NOT_FOUND'; end if;
 if p_profile is not null then
   perform pg_advisory_xact_lock(hashtext('krug-studio-booking'));
   insert into public.staff_booking_profiles(staff_id) values(p_staff_id) on conflict do nothing;
   select * into profile from public.staff_booking_profiles where staff_id=p_staff_id for update;
   if p_expected_version is distinct from profile.version then raise exception 'STAFF_SCHEDULE_CONFLICT'; end if;
   ids:=p_profile->'serviceIds';
   if not private.krug_validate_schedule(p_profile->'schedule') or jsonb_typeof(ids) is distinct from 'array'
     or jsonb_array_length(ids)>100 then raise exception 'STAFF_SCHEDULE_INVALID'; end if;
   update public.staff_booking_profiles set display_name=trim(coalesce(p_profile->>'name','')),
     photo_url=coalesce(p_profile->>'photoUrl',''),experience_since=nullif(p_profile->>'experienceSince','')::integer,
     genres=coalesce(p_profile->>'genres',''),bio=coalesce(p_profile->>'bio',''),
     published=coalesce((p_profile->>'published')::boolean,false),
     priority=coalesce((p_profile->>'priority')::integer,100),schedule=p_profile->'schedule',version=version+1
     where staff_id=p_staff_id;
   delete from public.staff_service_qualifications where staff_id=p_staff_id;
   insert into public.staff_service_qualifications select distinct p_staff_id,jsonb_array_elements_text(ids);
 end if;
 select * into profile from public.staff_booking_profiles where staff_id=p_staff_id;
 return jsonb_build_object('staffId',p_staff_id,'name',coalesce(profile.display_name,''),'photoUrl',coalesce(profile.photo_url,''),
   'experienceSince',profile.experience_since,'genres',coalesce(profile.genres,''),'bio',coalesce(profile.bio,''),
   'published',coalesce(profile.published,false),'priority',coalesce(profile.priority,100),'version',coalesce(profile.version,0),
   'schedule',coalesce(profile.schedule,'{"weekly":{},"exceptions":{}}'::jsonb),
   'serviceIds',(select coalesce(jsonb_agg(service_id),'[]') from public.staff_service_qualifications where staff_id=p_staff_id),
   'services',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'staffSelection',staff_selection) order by sort_order),'[]') from public.services where active and not legacy_only));
end $$;
revoke all on function public.krug_crm_staff_schedule(uuid,text,jsonb,integer) from public,anon,authenticated;
grant execute on function public.krug_crm_staff_schedule(uuid,text,jsonb,integer) to service_role;

-- The lock covers candidate selection, the existing room/loyalty transaction, and assignment.
create function public.krug_create_booking_v4(p_request_id uuid,p_service_id text,p_date date,p_start_time time,
 p_duration_hours numeric,p_client_name text,p_client_phone text,p_client_telegram text default null,
 p_telegram_user_id bigint default null,p_comment text default '',p_use_bonuses boolean default false,p_staff_id text default null)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare existing public.bookings; result jsonb; mode text; choices jsonb; chosen jsonb; s timestamptz;
begin
 perform pg_advisory_xact_lock(hashtext('krug-studio-booking'));
 select * into existing from public.bookings where request_id=p_request_id;
 if found then
   if not exists(select 1 from public.clients where id=existing.client_id and telegram_user_id=p_telegram_user_id) then raise exception 'INVALID_REQUEST_ID'; end if;
   select value into result from jsonb_array_elements(public.krug_list_bookings_for_telegram(p_telegram_user_id)) where value->>'id'=existing.id::text;
   return result||jsonb_build_object('staffId',existing.staff_id,'staffName',existing.staff_name_snapshot);
 end if;
 select staff_selection into mode from public.services where id=p_service_id;
 if mode is null then raise exception 'SERVICE_UNAVAILABLE'; end if;
 if mode='none' and p_staff_id is not null then raise exception 'STAFF_NOT_SUPPORTED'; end if;
 if mode='required' and p_staff_id is null then raise exception 'STAFF_REQUIRED'; end if;
 if mode<>'none' then
   s:=(p_date+p_start_time) at time zone 'Europe/Moscow';
   choices:=private.krug_staff_candidates(p_service_id,s,s+p_duration_hours*interval '1 hour');
   if p_staff_id is null then chosen:=choices->0;
   else select value into chosen from jsonb_array_elements(choices) where value->>'id'=p_staff_id; end if;
   if chosen is null then raise exception 'STAFF_UNAVAILABLE'; end if;
 end if;
 result:=public.krug_create_booking_v3(p_request_id,p_service_id,p_date,p_start_time,p_duration_hours,
   p_client_name,p_client_phone,p_client_telegram,p_telegram_user_id,p_comment,p_use_bonuses);
 update public.bookings set staff_id=chosen->>'id',staff_name_snapshot=chosen->>'name' where request_id=p_request_id;
 return result||jsonb_build_object('staffId',chosen->>'id','staffName',chosen->>'name');
end $$;
revoke all on function public.krug_create_booking_v4(uuid,text,date,time,numeric,text,text,text,bigint,text,boolean,text) from public,anon,authenticated;
grant execute on function public.krug_create_booking_v4(uuid,text,date,time,numeric,text,text,text,bigint,text,boolean,text) to service_role;
-- Old entry points remain usable internally but cannot bypass assignment through the API.
revoke execute on function public.krug_create_booking_v2(uuid,text,date,time,numeric,text,text,text,bigint,text) from service_role;
revoke execute on function public.krug_create_booking_v3(uuid,text,date,time,numeric,text,text,text,bigint,text,boolean) from service_role;

-- CRM writers share the same lock, and cannot save an overlapping room reservation.
create function private.krug_guard_crm_room() returns trigger language plpgsql set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtext('krug-studio-booking'));
 if exists(select 1 from private.krug_crm_busy(new.data) c join public.bookings b
   on b.status in ('request','confirmed','in_progress') and c.period && tstzrange(b.starts_at,b.ends_at,'[)')) then
   raise exception 'SLOT_UNAVAILABLE';
 end if;
 return new;
end $$;
create trigger krug_guard_crm_room before insert or update of data on public.crm_shared_state
for each row execute function private.krug_guard_crm_room();

revoke all on function private.krug_validate_schedule(jsonb),private.krug_staff_on_duty(jsonb,timestamptz,timestamptz),
 private.krug_crm_interval(jsonb),private.krug_crm_busy(jsonb),private.krug_staff_candidates(text,timestamptz,timestamptz),
 private.krug_guard_crm_room() from public,anon,authenticated;

-- KRUG 0.9.1 — Telegram identity is authoritative for Mini App booking history.

create or replace function public.krug_list_bookings_for_telegram(p_telegram_user_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_client_id uuid;
  v_result jsonb;
begin
  if p_telegram_user_id is null or p_telegram_user_id <= 0 then
    raise exception 'INVALID_TELEGRAM_USER_ID' using errcode='P0001';
  end if;

  select c.id into v_client_id
  from public.clients c
  where c.telegram_user_id = p_telegram_user_id
    and c.merged_into_client_id is null
  limit 1;

  if v_client_id is null then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', b.id,
      'requestId', b.request_id,
      'serviceId', b.service_id,
      'serviceName', b.service_name_snapshot,
      'staffId',b.staff_id,'staffName',b.staff_name_snapshot,
      'date', to_char(b.starts_at at time zone 'Europe/Moscow', 'YYYY-MM-DD'),
      'startTime', to_char(b.starts_at at time zone 'Europe/Moscow', 'HH24:MI'),
      'durationHours', extract(epoch from (b.ends_at - b.starts_at)) / 3600,
      'price', b.price_rub,
      'priceSnapshot', b.price_snapshot,
      'amountDue', b.amount_due_rub,
      'status', b.status,
      'paymentStatus', b.payment_status,
      'paymentMode', 'on_site_only',
      'bonusReserved', b.bonus_reserved,
      'bonusSpent', b.bonus_spent,
      'bonusEarned', 0,
      'cancelledAt', b.cancelled_at,
      'cancelledAfterStart', b.cancelled_after_start,
      'createdAt', b.created_at
    ) order by b.starts_at desc
  ), '[]'::jsonb)
  into v_result
  from public.bookings b
  where b.client_id = v_client_id;

  return v_result;
end;
$$;

revoke all on function public.krug_list_bookings_for_telegram(bigint) from public, anon, authenticated;
grant execute on function public.krug_list_bookings_for_telegram(bigint) to service_role;

-- KRUG 0.9.3 — keep long-lived CRM history while Mini App remains server-authoritative.

create or replace function public.krug_admin_bookings_overview(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare v_rows jsonb;
begin
  if not private.krug_admin_token_valid(p_token) then raise exception 'ADMIN_UNAUTHORIZED' using errcode='P0001'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',b.id,'requestId',b.request_id,'clientId',b.client_id,'clientName',c.name,'phone',c.phone,
    'telegram',case when c.telegram_username is null then null else '@'||c.telegram_username end,
    'telegramUserId',c.telegram_user_id,'serviceId',b.service_id,'serviceName',b.service_name_snapshot,'staffId',b.staff_id,'staffName',b.staff_name_snapshot,
    'date',to_char(b.starts_at at time zone 'Europe/Moscow','YYYY-MM-DD'),
    'startTime',to_char(b.starts_at at time zone 'Europe/Moscow','HH24:MI'),
    'endTime',to_char(b.ends_at at time zone 'Europe/Moscow','HH24:MI'),
    'durationHours',extract(epoch from (b.ends_at-b.starts_at))/3600,
    'price',b.price_rub,'amountDue',b.amount_due_rub,'bonusReserved',b.bonus_reserved,'bonusSpent',b.bonus_spent,
    'status',b.status,'paymentStatus',b.payment_status,'paidAt',b.paid_at,'paidAmount',b.paid_amount_rub,'paymentMethod',b.payment_method,
    'comment',b.comment,'createdAt',b.created_at
  ) order by b.starts_at desc),'[]'::jsonb)
  into v_rows
  from public.bookings b join public.clients c on c.id=b.client_id
  where b.created_at >= now()-interval '4 years';
  return v_rows;
end;
$$;
