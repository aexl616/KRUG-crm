-- 0.11.4 — cyclic staff schedules
-- Preserve weekly schedules, exceptions, existing RPC signatures and room locking.
begin;

create or replace function private.krug_validate_schedule(p_schedule jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare layer text; day record; slot jsonb; count_days integer; cycle jsonb;
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
      if jsonb_typeof(day.value) is distinct from 'array' or jsonb_array_length(day.value)>8 then return false; end if;
      for slot in select * from jsonb_array_elements(day.value) loop
        if jsonb_typeof(slot) is distinct from 'object' or coalesce(slot->>'start','') !~ '^([01]\d|2[0-3]):[0-5]\d$'
          or coalesce(slot->>'end','') !~ '^([01]\d|2[0-3]):[0-5]\d$' or slot->>'start'=slot->>'end' then return false; end if;
      end loop;
    end loop;
  end loop;
  if p_schedule ? 'mode' and coalesce(p_schedule->>'mode','') not in ('weekly','cyclic') then return false; end if;
  if p_schedule->>'mode'='cyclic' and not (p_schedule ? 'cycle') then return false; end if;
  if p_schedule ? 'cycle' then
    cycle:=p_schedule->'cycle';
    if jsonb_typeof(cycle) is distinct from 'object'
      or jsonb_typeof(cycle->'workDays') is distinct from 'number'
      or jsonb_typeof(cycle->'offDays') is distinct from 'number'
      or coalesce(cycle->>'workDays','') !~ '^[1-9][0-9]{0,2}$'
      or coalesce(cycle->>'offDays','') !~ '^[1-9][0-9]{0,2}$' then return false; end if;
    if (cycle->>'workDays')::integer>366 or (cycle->>'offDays')::integer>366 then return false; end if;
    if coalesce(cycle->>'startDate','') !~ '^\d{4}-\d{2}-\d{2}$'
      or to_char((cycle->>'startDate')::date,'YYYY-MM-DD')<>cycle->>'startDate' then return false; end if;
    if jsonb_typeof(cycle->'intervals') is distinct from 'array' then return false; end if;
    if jsonb_array_length(cycle->'intervals') not between 1 and 8 then return false; end if;
    -- Reuse the same interval validation, including overnight shifts.
    if not private.krug_validate_schedule(jsonb_build_object('weekly',jsonb_build_object('1',cycle->'intervals'),'exceptions','{}'::jsonb)) then return false; end if;
  end if;
  return true;
exception when others then return false;
end $$;
-- Legacy documents without mode remain weekly. The anchor is the first work day;
-- dates before it have no cyclic shifts. Calendar-date exceptions always win.
create or replace function private.krug_staff_day_intervals(p_schedule jsonb,p_day date)
returns jsonb language sql immutable set search_path='' as $$
 select case
   when p_schedule->'exceptions' ? p_day::text then p_schedule->'exceptions'->p_day::text
   when p_schedule->>'mode'='cyclic' then case
     when p_day >= (p_schedule->'cycle'->>'startDate')::date
       and (p_day-(p_schedule->'cycle'->>'startDate')::date) %
         ((p_schedule->'cycle'->>'workDays')::integer+(p_schedule->'cycle'->>'offDays')::integer)
         < (p_schedule->'cycle'->>'workDays')::integer
     then p_schedule->'cycle'->'intervals' else '[]'::jsonb end
   else coalesce(p_schedule->'weekly'->extract(isodow from p_day)::integer::text,'[]'::jsonb)
 end;
$$;
revoke all on function private.krug_staff_day_intervals(jsonb,date) from public,anon,authenticated;

create or replace function private.krug_staff_on_duty(p_schedule jsonb,p_start timestamptz,p_end timestamptz)
returns boolean language sql stable set search_path='' as $$
  with days as (
    select d::date as day from generate_series((p_start at time zone 'Europe/Moscow')::date::timestamp,
      ((p_end-interval '1 microsecond') at time zone 'Europe/Moscow')::date::timestamp,interval '1 day') d
  ), sources as (
    select day,day-offset_days source_day from days cross join generate_series(0,1) offset_days
    where offset_days=0 or not (p_schedule->'exceptions' ? day::text)
  ), intervals as (
    select day,source_day,slot from sources cross join lateral jsonb_array_elements(
      private.krug_staff_day_intervals(p_schedule,source_day)) slot
  ), bounds as (
    select greatest(day::timestamp,source_day+(slot->>'start')::time) at time zone 'Europe/Moscow' lo,
      least((day+1)::timestamp,source_day+(slot->>'end')::time+
        case when slot->>'end'<slot->>'start' then interval '1 day' else interval '0' end) at time zone 'Europe/Moscow' hi
    from intervals
  ) select p_end>p_start and coalesce((select range_agg(tstzrange(lo,hi,'[)')) @> tstzrange(p_start,p_end,'[)') from bounds where hi>lo),false);
$$;

-- A cleared optional selection stays unassigned. The client sends the recommended
-- staff ID explicitly for automatic selection; null must not silently reassign it.
create or replace function public.krug_create_booking_v4(p_request_id uuid,p_service_id text,p_date date,p_start_time time,
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
   if p_staff_id is not null then
     select value into chosen from jsonb_array_elements(choices) where value->>'id'=p_staff_id;
     if chosen is null then raise exception 'STAFF_UNAVAILABLE'; end if;

   elsif mode='required' then
     raise exception 'STAFF_UNAVAILABLE';
   end if;
 end if;
 result:=public.krug_create_booking_v3(p_request_id,p_service_id,p_date,p_start_time,p_duration_hours,
   p_client_name,p_client_phone,p_client_telegram,p_telegram_user_id,p_comment,p_use_bonuses);
 update public.bookings set staff_id=chosen->>'id',staff_name_snapshot=chosen->>'name' where request_id=p_request_id;
 return result||jsonb_build_object('staffId',chosen->>'id','staffName',chosen->>'name');
end $$;
revoke all on function public.krug_create_booking_v4(uuid,text,date,time,numeric,text,text,text,bigint,text,boolean,text) from public,anon,authenticated;
grant execute on function public.krug_create_booking_v4(uuid,text,date,time,numeric,text,text,text,bigint,text,boolean,text) to service_role;

commit;
