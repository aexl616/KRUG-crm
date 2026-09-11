-- KRUG 0.4.2 booking core.
-- Studio-time services are booked online but paid only on-site.

alter table public.clients
  add column if not exists phone_normalized text generated always as (regexp_replace(coalesce(phone, ''), '\D', '', 'g')) stored;

create unique index if not exists clients_phone_normalized_uq
  on public.clients (phone_normalized)
  where char_length(phone_normalized) between 7 and 15;

alter table public.bookings
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists paid_at timestamptz,
  add column if not exists paid_amount_rub integer,
  add column if not exists payment_method text;

alter table public.bookings drop constraint if exists bookings_payment_status_check;
alter table public.bookings
  add constraint bookings_payment_status_check check (payment_status in ('unpaid', 'paid'));

alter table public.bookings drop constraint if exists bookings_paid_amount_rub_check;
alter table public.bookings
  add constraint bookings_paid_amount_rub_check check (paid_amount_rub is null or paid_amount_rub >= 0);

create table if not exists public.studio_hours (
  day_of_week smallint primary key check (day_of_week between 1 and 7),
  is_open boolean not null default true,
  opens_at time,
  closes_at time,
  updated_at timestamptz not null default now(),
  check ((is_open = false) or (opens_at is not null and closes_at is not null and closes_at > opens_at))
);

insert into public.studio_hours (day_of_week, is_open, opens_at, closes_at)
values
  (1, true, '09:00', '23:00'), (2, true, '09:00', '23:00'),
  (3, true, '09:00', '23:00'), (4, true, '09:00', '23:00'),
  (5, true, '09:00', '23:00'), (6, true, '09:00', '23:00'),
  (7, false, null, null)
on conflict (day_of_week) do nothing;

create table if not exists public.studio_blocks (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  block_type text not null default 'closed',
  note text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (char_length(note) <= 1000)
);

create index if not exists studio_blocks_active_time_idx
  on public.studio_blocks (starts_at, ends_at)
  where active = true;

create or replace trigger studio_hours_set_updated_at
before update on public.studio_hours
for each row execute function public.set_updated_at();

create or replace trigger studio_blocks_set_updated_at
before update on public.studio_blocks
for each row execute function public.set_updated_at();

alter table public.studio_hours enable row level security;
alter table public.studio_blocks enable row level security;
revoke all on public.clients, public.bookings, public.studio_hours, public.studio_blocks from anon, authenticated;

create or replace function public.krug_price_period(
  p_service_id text,
  p_period_key text,
  p_duration_hours numeric,
  p_extra_hour_rub integer default null
)
returns integer
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_exact integer;
  v_base_duration numeric;
  v_base_price integer;
begin
  if p_duration_hours is null or p_duration_hours <= 0 then return null; end if;

  select total_price_rub into v_exact
  from public.service_price_tiers
  where service_id = p_service_id
    and period_key = p_period_key
    and duration_hours = p_duration_hours
  limit 1;
  if v_exact is not null then return v_exact; end if;
  if p_extra_hour_rub is null then return null; end if;

  select duration_hours, total_price_rub into v_base_duration, v_base_price
  from public.service_price_tiers
  where service_id = p_service_id
    and period_key = p_period_key
    and duration_hours < p_duration_hours
  order by duration_hours desc
  limit 1;

  if v_base_duration is null then
    return round(p_duration_hours * p_extra_hour_rub)::integer;
  end if;
  return v_base_price + round((p_duration_hours - v_base_duration) * p_extra_hour_rub)::integer;
end;
$$;

revoke all on function public.krug_price_period(text, text, numeric, integer) from public, anon, authenticated;

create or replace function public.krug_quote_price(
  p_service_id text,
  p_duration_hours numeric,
  p_start_time time default null
)
returns integer
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_service public.services%rowtype;
  v_price integer;
  v_hourly integer;
  v_regular_extra integer;
  v_morning_extra integer;
  v_morning_start time;
  v_morning_end time;
  v_start_anchor timestamp;
  v_end_anchor timestamp;
  v_morning_start_anchor timestamp;
  v_morning_end_anchor timestamp;
  v_morning_hours numeric;
  v_regular_hours numeric;
  v_morning_price integer := 0;
  v_regular_price integer := 0;
begin
  if p_duration_hours is null or p_duration_hours <= 0 or p_duration_hours > 12 then return null; end if;

  select * into v_service
  from public.services
  where id = p_service_id and active = true and legacy_only = false;
  if not found then return null; end if;
  if v_service.min_duration_hours is not null and p_duration_hours < v_service.min_duration_hours then return null; end if;

  if v_service.pricing_type = 'minimum' then
    select total_price_rub into v_price
    from public.service_price_tiers
    where service_id = p_service_id and period_key = 'regular'
    order by duration_hours asc limit 1;
    return v_price;
  end if;

  if p_service_id = 'recording' and p_start_time is not null and (v_service.pricing_rules ? 'morning') then
    v_morning_start := (v_service.pricing_rules #>> '{morning,start}')::time;
    v_morning_end := (v_service.pricing_rules #>> '{morning,end}')::time;
    v_morning_extra := nullif(v_service.pricing_rules #>> '{morning,extraHour}', '')::integer;
    v_regular_extra := nullif(v_service.pricing_rules #>> '{regular,extraHour}', '')::integer;
    v_start_anchor := date '2000-01-01' + p_start_time;
    v_end_anchor := v_start_anchor + make_interval(secs => (p_duration_hours * 3600)::double precision);
    v_morning_start_anchor := date '2000-01-01' + v_morning_start;
    v_morning_end_anchor := date '2000-01-01' + v_morning_end;
    v_morning_hours := greatest(0, extract(epoch from (least(v_end_anchor, v_morning_end_anchor) - greatest(v_start_anchor, v_morning_start_anchor))) / 3600);
    v_regular_hours := p_duration_hours - v_morning_hours;
    if v_morning_hours > 0 then
      v_morning_price := public.krug_price_period('recording', 'morning', v_morning_hours, v_morning_extra);
      if v_morning_price is null then return null; end if;
    end if;
    if v_regular_hours > 0 then
      v_regular_price := public.krug_price_period('recording', 'regular', v_regular_hours, v_regular_extra);
      if v_regular_price is null then return null; end if;
    end if;
    return v_morning_price + v_regular_price;
  end if;

  select total_price_rub into v_price
  from public.service_price_tiers
  where service_id = p_service_id and period_key = 'regular' and duration_hours = p_duration_hours
  limit 1;
  if v_price is not null then return v_price; end if;

  v_hourly := nullif(v_service.pricing_rules ->> 'hourlyRate', '')::integer;
  if v_hourly is not null then return round(p_duration_hours * v_hourly)::integer; end if;

  v_regular_extra := nullif(v_service.pricing_rules #>> '{regular,extraHour}', '')::integer;
  if v_regular_extra is not null then
    return public.krug_price_period(p_service_id, 'regular', p_duration_hours, v_regular_extra);
  end if;
  return null;
end;
$$;

revoke all on function public.krug_quote_price(text, numeric, time) from public, anon, authenticated;

create or replace function public.krug_available_slots(p_date date, p_duration_hours numeric, p_service_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_hours public.studio_hours%rowtype;
  v_service public.services%rowtype;
  v_candidate_local timestamp;
  v_candidate timestamptz;
  v_end timestamptz;
  v_slots jsonb := '[]'::jsonb;
  v_price integer;
  v_day smallint;
begin
  if p_date is null or p_duration_hours is null or p_duration_hours <= 0 or p_duration_hours > 12 then
    return jsonb_build_object('date', p_date, 'closed', true, 'slots', v_slots);
  end if;

  select * into v_service from public.services
  where id = p_service_id and active = true and legacy_only = false;
  if not found then return jsonb_build_object('date', p_date, 'closed', true, 'slots', v_slots); end if;

  v_day := extract(isodow from p_date)::smallint;
  select * into v_hours from public.studio_hours where day_of_week = v_day;
  if not found or v_hours.is_open = false then
    return jsonb_build_object('date', p_date, 'closed', true, 'slots', v_slots);
  end if;

  for v_candidate_local in
    select generate_series(
      p_date + v_hours.opens_at,
      (p_date + v_hours.closes_at) - make_interval(secs => (p_duration_hours * 3600)::double precision),
      interval '1 hour'
    )
  loop
    v_candidate := v_candidate_local at time zone 'Europe/Moscow';
    v_end := v_candidate + make_interval(secs => (p_duration_hours * 3600)::double precision);
    if v_candidate <= now() then continue; end if;
    v_price := public.krug_quote_price(p_service_id, p_duration_hours, v_candidate_local::time);
    if v_price is null then continue; end if;
    if exists (select 1 from public.bookings b where b.status in ('request','confirmed','in_progress') and b.starts_at < v_end and b.ends_at > v_candidate) then continue; end if;
    if exists (select 1 from public.studio_blocks s where s.active = true and s.starts_at < v_end and s.ends_at > v_candidate) then continue; end if;
    v_slots := v_slots || to_jsonb(to_char(v_candidate_local, 'HH24:MI'));
  end loop;

  return jsonb_build_object('date', p_date, 'closed', false, 'open', to_char(v_hours.opens_at, 'HH24:MI'), 'close', to_char(v_hours.closes_at, 'HH24:MI'), 'timezone', 'Europe/Moscow', 'slots', v_slots);
end;
$$;

revoke all on function public.krug_available_slots(date, numeric, text) from public;
grant execute on function public.krug_available_slots(date, numeric, text) to anon, authenticated;

create or replace function public.krug_create_booking(
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
set search_path = public, pg_temp
as $$
declare
  v_existing public.bookings%rowtype;
  v_service public.services%rowtype;
  v_client public.clients%rowtype;
  v_booking public.bookings%rowtype;
  v_phone_digits text;
  v_telegram_username text;
  v_start timestamptz;
  v_end timestamptz;
  v_price integer;
  v_availability jsonb;
  v_slot text;
begin
  if p_request_id is null then raise exception 'INVALID_REQUEST_ID' using errcode = 'P0001'; end if;

  select * into v_existing from public.bookings where request_id = p_request_id;
  if found then
    return jsonb_build_object('id',v_existing.id,'requestId',v_existing.request_id,'serviceId',v_existing.service_id,'serviceName',v_existing.service_name_snapshot,'date',to_char(v_existing.starts_at at time zone 'Europe/Moscow','YYYY-MM-DD'),'startTime',to_char(v_existing.starts_at at time zone 'Europe/Moscow','HH24:MI'),'durationHours',extract(epoch from (v_existing.ends_at-v_existing.starts_at))/3600,'price',v_existing.price_rub,'amountDue',v_existing.amount_due_rub,'status',v_existing.status,'paymentStatus',v_existing.payment_status,'paymentMode','on_site_only','createdAt',v_existing.created_at);
  end if;

  if p_client_name is null or char_length(trim(p_client_name)) < 2 or char_length(trim(p_client_name)) > 80 then raise exception 'INVALID_CLIENT_NAME' using errcode = 'P0001'; end if;
  v_phone_digits := regexp_replace(coalesce(p_client_phone,''), '\D', '', 'g');
  if char_length(v_phone_digits) < 7 or char_length(v_phone_digits) > 15 then raise exception 'INVALID_CLIENT_PHONE' using errcode = 'P0001'; end if;
  v_telegram_username := nullif(regexp_replace(trim(coalesce(p_client_telegram,'')), '^@', ''), '');
  if v_telegram_username is not null and v_telegram_username !~ '^[A-Za-z][A-Za-z0-9_]{4,31}$' then raise exception 'INVALID_CLIENT_TELEGRAM' using errcode = 'P0001'; end if;
  if p_comment is not null and char_length(p_comment) > 1000 then raise exception 'COMMENT_TOO_LONG' using errcode = 'P0001'; end if;
  if p_date < (now() at time zone 'Europe/Moscow')::date then raise exception 'BOOKING_IN_PAST' using errcode = 'P0001'; end if;
  if p_date > ((now() at time zone 'Europe/Moscow')::date + 21) then raise exception 'BOOKING_TOO_FAR' using errcode = 'P0001'; end if;

  select * into v_service from public.services where id = p_service_id and active = true and legacy_only = false;
  if not found then raise exception 'SERVICE_UNAVAILABLE' using errcode = 'P0001'; end if;
  v_price := public.krug_quote_price(p_service_id,p_duration_hours,p_start_time);
  if v_price is null then raise exception 'DURATION_UNAVAILABLE' using errcode = 'P0001'; end if;

  perform pg_advisory_xact_lock(hashtext('krug-studio-booking'));
  v_availability := public.krug_available_slots(p_date,p_duration_hours,p_service_id);
  v_slot := to_char(p_start_time,'HH24:MI');
  if not coalesce((v_availability->'slots') ? v_slot,false) then raise exception 'SLOT_UNAVAILABLE' using errcode = 'P0001'; end if;

  v_start := (p_date+p_start_time) at time zone 'Europe/Moscow';
  v_end := v_start + make_interval(secs => (p_duration_hours*3600)::double precision);

  if p_telegram_user_id is not null then select * into v_client from public.clients where telegram_user_id=p_telegram_user_id limit 1; end if;
  if v_client.id is null then select * into v_client from public.clients where phone_normalized=v_phone_digits limit 1; end if;

  if v_client.id is null then
    insert into public.clients (telegram_user_id,name,phone,telegram_username)
    values (p_telegram_user_id,trim(p_client_name),trim(p_client_phone),v_telegram_username)
    returning * into v_client;
  else
    update public.clients set
      name=trim(p_client_name), phone=trim(p_client_phone),
      telegram_username=coalesce(v_telegram_username,telegram_username),
      telegram_user_id=case when telegram_user_id is null then p_telegram_user_id else telegram_user_id end
    where id=v_client.id returning * into v_client;
  end if;

  insert into public.bookings (
    request_id,client_id,service_id,service_name_snapshot,starts_at,ends_at,status,
    price_rub,price_snapshot,bonus_reserved,bonus_spent,amount_due_rub,comment,payment_status
  ) values (
    p_request_id,v_client.id,v_service.id,v_service.name,v_start,v_end,'request',v_price,
    jsonb_build_object('serviceId',v_service.id,'pricingType',v_service.pricing_type,'durationHours',p_duration_hours,'date',p_date,'startTime',to_char(p_start_time,'HH24:MI'),'totalPrice',v_price,'serverCalculated',true),
    0,0,v_price,left(coalesce(p_comment,''),1000),'unpaid'
  ) returning * into v_booking;

  return jsonb_build_object('id',v_booking.id,'requestId',v_booking.request_id,'serviceId',v_booking.service_id,'serviceName',v_booking.service_name_snapshot,'date',to_char(v_booking.starts_at at time zone 'Europe/Moscow','YYYY-MM-DD'),'startTime',to_char(v_booking.starts_at at time zone 'Europe/Moscow','HH24:MI'),'durationHours',extract(epoch from (v_booking.ends_at-v_booking.starts_at))/3600,'price',v_booking.price_rub,'amountDue',v_booking.amount_due_rub,'status',v_booking.status,'paymentStatus',v_booking.payment_status,'paymentMode','on_site_only','createdAt',v_booking.created_at);
end;
$$;

revoke all on function public.krug_create_booking(uuid,text,date,time,numeric,text,text,text,bigint,text) from public;
grant execute on function public.krug_create_booking(uuid,text,date,time,numeric,text,text,text,bigint,text) to anon, authenticated;
