-- Optional specialist choice must never hide an otherwise free room slot.
-- Required staff still gates availability; optional staff may remain unassigned.

create or replace function public.krug_available_slots(p_date date,p_duration_hours numeric,p_service_id text)
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
     if mode='required' and jsonb_array_length(candidates)=0 then continue; end if;
     choices:=choices||jsonb_build_object(slot,jsonb_build_object('staff',candidates,'defaultStaffId',candidates->0->>'id'));
   end if;
   slots:=slots||to_jsonb(slot);
 end loop;
 return result||jsonb_build_object('slots',slots,'staffSelection',coalesce(mode,'none'),'staffBySlot',choices);
end $$;
revoke all on function public.krug_available_slots(date,numeric,text) from public;
grant execute on function public.krug_available_slots(date,numeric,text) to anon,authenticated,service_role;

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
   elsif jsonb_array_length(choices)>0 then
     chosen:=choices->0;
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
