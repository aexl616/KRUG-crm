-- KRUG 0.5 — live loyalty reservations, settlement and Mini App booking operations.

alter table public.bookings
  add column if not exists bonus_requested boolean not null default false;

create table if not exists public.loyalty_reservations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  points integer not null check (points > 0),
  rubles_per_point integer not null default 1 check (rubles_per_point > 0),
  status text not null default 'reserved' check (status in ('reserved','spent','refunded')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (booking_id)
);
create index if not exists loyalty_reservations_client_status_idx
  on public.loyalty_reservations (client_id, status, created_at desc);
alter table public.loyalty_reservations enable row level security;
revoke all on public.loyalty_reservations from anon, authenticated;

create unique index if not exists loyalty_booking_spend_uq
  on public.loyalty_transactions (booking_id, kind)
  where booking_id is not null and kind = 'booking_spend';
create unique index if not exists loyalty_booking_accrual_uq
  on public.loyalty_transactions (booking_id, kind)
  where booking_id is not null and kind = 'booking_accrual';

create or replace function public.krug_loyalty_available(p_client_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select greatest(
    0,
    public.krug_loyalty_balance(p_client_id) - coalesce((
      select sum(r.points)::integer
      from public.loyalty_reservations r
      where r.client_id = p_client_id and r.status = 'reserved'
    ),0)
  );
$$;
revoke all on function public.krug_loyalty_available(uuid) from public, anon, authenticated;

create or replace function public.krug_loyalty_snapshot(p_telegram_user_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_client public.clients%rowtype;
  v_settings public.loyalty_settings%rowtype;
  v_ledger integer := 0;
  v_reserved integer := 0;
  v_available integer := 0;
  v_history jsonb := '[]'::jsonb;
begin
  if p_telegram_user_id is null or p_telegram_user_id <= 0 then
    raise exception 'INVALID_TELEGRAM_USER_ID' using errcode='P0001';
  end if;

  select * into v_client from public.clients
  where telegram_user_id = p_telegram_user_id and merged_into_client_id is null
  limit 1;
  if not found then raise exception 'CLIENT_NOT_FOUND' using errcode='P0001'; end if;

  select * into v_settings from public.loyalty_settings where singleton = true;
  v_ledger := public.krug_loyalty_balance(v_client.id);
  select coalesce(sum(points),0)::integer into v_reserved
  from public.loyalty_reservations
  where client_id = v_client.id and status = 'reserved';
  v_available := greatest(0, v_ledger - v_reserved);

  with entries as (
    select
      t.id::text as id,
      t.amount_points as amount,
      case t.kind
        when 'manual_accrual' then 'Начисление'
        when 'manual_writeoff' then 'Списание'
        when 'booking_accrual' then 'Начисление · ' || coalesce(b.service_name_snapshot,'Сессия')
        when 'booking_spend' then 'Списание · ' || coalesce(b.service_name_snapshot,'Сессия')
        else coalesce(nullif(t.reason,''),'Изменение баланса')
      end as title,
      t.kind as kind,
      t.reason as reason,
      t.created_at as created_at
    from public.loyalty_transactions t
    left join public.bookings b on b.id=t.booking_id
    where t.client_id=v_client.id

    union all

    select
      r.id::text || '-reserve',
      -r.points,
      'Резерв · ' || coalesce(b.service_name_snapshot,'Сессия'),
      'booking_reserve',
      '',
      r.created_at
    from public.loyalty_reservations r
    left join public.bookings b on b.id=r.booking_id
    where r.client_id=v_client.id and r.status in ('reserved','refunded')

    union all

    select
      r.id::text || '-refund',
      r.points,
      'Возврат за отмену',
      'booking_refund',
      '',
      r.resolved_at
    from public.loyalty_reservations r
    where r.client_id=v_client.id and r.status='refunded' and r.resolved_at is not null
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,
    'amount',amount,
    'title',title,
    'kind',kind,
    'reason',reason,
    'date',to_char(created_at at time zone 'Europe/Moscow','YYYY-MM-DD'),
    'createdAt',created_at
  ) order by created_at desc),'[]'::jsonb)
  into v_history
  from (select * from entries order by created_at desc limit 100) q;

  return jsonb_build_object(
    'clientId',v_client.id,
    'balance',v_available,
    'ledgerBalance',v_ledger,
    'reserved',v_reserved,
    'rublesPerBonus',coalesce(v_settings.rubles_per_point,1),
    'accrualPercent',coalesce(v_settings.accrual_percent,0),
    'enabled',coalesce(v_settings.enabled,false),
    'history',v_history
  );
end;
$$;
revoke all on function public.krug_loyalty_snapshot(bigint) from public, authenticated;
grant execute on function public.krug_loyalty_snapshot(bigint) to anon, service_role;

create or replace function public.krug_create_booking_v3(
  p_request_id uuid,
  p_service_id text,
  p_date date,
  p_start_time time,
  p_duration_hours numeric,
  p_client_name text,
  p_client_phone text,
  p_client_telegram text default null,
  p_telegram_user_id bigint default null,
  p_comment text default '',
  p_use_bonuses boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_base jsonb;
  v_booking public.bookings%rowtype;
  v_settings public.loyalty_settings%rowtype;
  v_available integer := 0;
  v_points integer := 0;
  v_rubles_per_point integer := 1;
  v_existing_reservation public.loyalty_reservations%rowtype;
begin
  v_base := public.krug_create_booking_v2(
    p_request_id,p_service_id,p_date,p_start_time,p_duration_hours,
    p_client_name,p_client_phone,p_client_telegram,p_telegram_user_id,p_comment
  );

  select * into v_booking from public.bookings where request_id=p_request_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND' using errcode='P0001'; end if;

  select * into v_existing_reservation from public.loyalty_reservations where booking_id=v_booking.id;
  if v_existing_reservation.id is null and coalesce(p_use_bonuses,false) and p_telegram_user_id is not null then
    perform pg_advisory_xact_lock(hashtext('krug-loyalty-' || v_booking.client_id::text));
    select * into v_settings from public.loyalty_settings where singleton=true;
    if coalesce(v_settings.enabled,false) then
      v_rubles_per_point := greatest(1,coalesce(v_settings.rubles_per_point,1));
      v_available := public.krug_loyalty_available(v_booking.client_id);
      v_points := least(v_available, floor(v_booking.price_rub::numeric / v_rubles_per_point)::integer);
      if v_points > 0 then
        insert into public.loyalty_reservations(client_id,booking_id,points,rubles_per_point)
        values(v_booking.client_id,v_booking.id,v_points,v_rubles_per_point)
        returning * into v_existing_reservation;
      end if;
    end if;
  end if;

  update public.bookings
  set bonus_requested=coalesce(p_use_bonuses,false),
      bonus_reserved=coalesce(v_existing_reservation.points,0),
      amount_due_rub=greatest(0,price_rub-coalesce(v_existing_reservation.points,0)*coalesce(v_existing_reservation.rubles_per_point,1))
  where id=v_booking.id
  returning * into v_booking;

  return jsonb_build_object(
    'id',v_booking.id,'requestId',v_booking.request_id,'serviceId',v_booking.service_id,
    'serviceName',v_booking.service_name_snapshot,
    'date',to_char(v_booking.starts_at at time zone 'Europe/Moscow','YYYY-MM-DD'),
    'startTime',to_char(v_booking.starts_at at time zone 'Europe/Moscow','HH24:MI'),
    'durationHours',extract(epoch from (v_booking.ends_at-v_booking.starts_at))/3600,
    'price',v_booking.price_rub,'amountDue',v_booking.amount_due_rub,
    'bonusReserved',v_booking.bonus_reserved,'bonusSpent',v_booking.bonus_spent,
    'status',v_booking.status,'paymentStatus',v_booking.payment_status,'paymentMode','on_site_only',
    'createdAt',v_booking.created_at
  );
end;
$$;
revoke all on function public.krug_create_booking_v3(uuid,text,date,time,numeric,text,text,text,bigint,text,boolean) from public, authenticated;
grant execute on function public.krug_create_booking_v3(uuid,text,date,time,numeric,text,text,text,bigint,text,boolean) to anon, service_role;

create or replace function public.krug_sync_bookings(p_request_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare v_result jsonb;
begin
  if p_request_ids is null or coalesce(array_length(p_request_ids,1),0)=0 then return '[]'::jsonb; end if;
  if array_length(p_request_ids,1)>50 then raise exception 'TOO_MANY_REQUEST_IDS' using errcode='P0001'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',b.id,'requestId',b.request_id,'serviceId',b.service_id,'serviceName',b.service_name_snapshot,
    'date',to_char(b.starts_at at time zone 'Europe/Moscow','YYYY-MM-DD'),
    'startTime',to_char(b.starts_at at time zone 'Europe/Moscow','HH24:MI'),
    'durationHours',extract(epoch from (b.ends_at-b.starts_at))/3600,
    'price',b.price_rub,'amountDue',b.amount_due_rub,
    'bonusReserved',b.bonus_reserved,'bonusSpent',b.bonus_spent,
    'status',b.status,'paymentStatus',b.payment_status,'paymentMode','on_site_only',
    'cancelledAt',b.cancelled_at,'cancelledAfterStart',b.cancelled_after_start,
    'paidAt',b.paid_at,'paidAmount',b.paid_amount_rub,'paymentMethod',b.payment_method,
    'createdAt',b.created_at
  ) order by b.starts_at desc),'[]'::jsonb)
  into v_result
  from public.bookings b where b.request_id=any(p_request_ids);
  return v_result;
end;
$$;
revoke all on function public.krug_sync_bookings(uuid[]) from public;
grant execute on function public.krug_sync_bookings(uuid[]) to anon, authenticated, service_role;

create or replace function public.krug_cancel_booking(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_booking public.bookings%rowtype;
  v_res public.loyalty_reservations%rowtype;
begin
  if p_request_id is null then raise exception 'INVALID_REQUEST_ID' using errcode='P0001'; end if;
  select * into v_booking from public.bookings where request_id=p_request_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND' using errcode='P0001'; end if;
  if v_booking.status='cancelled' then
    return jsonb_build_object('id',v_booking.id,'requestId',v_booking.request_id,'status',v_booking.status,'cancelledAt',v_booking.cancelled_at,'cancelledAfterStart',v_booking.cancelled_after_start,'bonusReserved',v_booking.bonus_reserved,'bonusSpent',v_booking.bonus_spent,'amountDue',v_booking.amount_due_rub);
  end if;
  if v_booking.status not in ('request','confirmed') then raise exception 'CANCELLATION_NOT_ALLOWED' using errcode='P0001'; end if;
  if now()>=v_booking.starts_at then raise exception 'CANCELLATION_AFTER_START' using errcode='P0001'; end if;

  select * into v_res from public.loyalty_reservations where booking_id=v_booking.id and status='reserved' for update;
  if v_res.id is not null then
    update public.loyalty_reservations set status='refunded',resolved_at=now() where id=v_res.id;
  end if;

  update public.bookings
  set status='cancelled',cancelled_at=now(),cancelled_after_start=false,
      bonus_reserved=0,amount_due_rub=price_rub
  where id=v_booking.id returning * into v_booking;

  return jsonb_build_object('id',v_booking.id,'requestId',v_booking.request_id,'status',v_booking.status,'cancelledAt',v_booking.cancelled_at,'cancelledAfterStart',false,'bonusReserved',0,'bonusSpent',v_booking.bonus_spent,'amountDue',v_booking.amount_due_rub);
end;
$$;
revoke all on function public.krug_cancel_booking(uuid) from public;
grant execute on function public.krug_cancel_booking(uuid) to anon, authenticated, service_role;

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
    'telegramUserId',c.telegram_user_id,'serviceId',b.service_id,'serviceName',b.service_name_snapshot,
    'date',to_char(b.starts_at at time zone 'Europe/Moscow','YYYY-MM-DD'),
    'startTime',to_char(b.starts_at at time zone 'Europe/Moscow','HH24:MI'),
    'endTime',to_char(b.ends_at at time zone 'Europe/Moscow','HH24:MI'),
    'durationHours',extract(epoch from (b.ends_at-b.starts_at))/3600,
    'price',b.price_rub,'amountDue',b.amount_due_rub,'bonusReserved',b.bonus_reserved,'bonusSpent',b.bonus_spent,
    'status',b.status,'paymentStatus',b.payment_status,'paidAmount',b.paid_amount_rub,'paymentMethod',b.payment_method,
    'comment',b.comment,'createdAt',b.created_at
  ) order by b.starts_at desc),'[]'::jsonb)
  into v_rows
  from public.bookings b join public.clients c on c.id=b.client_id
  where b.created_at >= now()-interval '120 days';
  return v_rows;
end;
$$;
revoke all on function public.krug_admin_bookings_overview(text) from public, authenticated;
grant execute on function public.krug_admin_bookings_overview(text) to anon;

create or replace function public.krug_admin_confirm_booking(p_token text,p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare v_booking public.bookings%rowtype;
begin
  if not private.krug_admin_token_valid(p_token) then raise exception 'ADMIN_UNAUTHORIZED' using errcode='P0001'; end if;
  select * into v_booking from public.bookings where id=p_booking_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND' using errcode='P0001'; end if;
  if v_booking.status='request' then
    update public.bookings set status='confirmed' where id=v_booking.id returning * into v_booking;
  elsif v_booking.status<>'confirmed' then
    raise exception 'STATUS_CHANGE_NOT_ALLOWED' using errcode='P0001';
  end if;
  return jsonb_build_object('id',v_booking.id,'status',v_booking.status);
end;
$$;
revoke all on function public.krug_admin_confirm_booking(text,uuid) from public, authenticated;
grant execute on function public.krug_admin_confirm_booking(text,uuid) to anon;

create or replace function public.krug_admin_settle_booking(
  p_token text,
  p_booking_id uuid,
  p_paid_amount integer default null,
  p_payment_method text default 'На студии'
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_booking public.bookings%rowtype;
  v_res public.loyalty_reservations%rowtype;
  v_settings public.loyalty_settings%rowtype;
  v_paid integer;
  v_earned integer := 0;
  v_rpp integer := 1;
begin
  if not private.krug_admin_token_valid(p_token) then raise exception 'ADMIN_UNAUTHORIZED' using errcode='P0001'; end if;
  select * into v_booking from public.bookings where id=p_booking_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND' using errcode='P0001'; end if;
  if v_booking.status='cancelled' then raise exception 'BOOKING_CANCELLED' using errcode='P0001'; end if;
  if now()<v_booking.starts_at then raise exception 'PAYMENT_BEFORE_START' using errcode='P0001'; end if;
  if v_booking.payment_status='paid' then
    return jsonb_build_object('id',v_booking.id,'status',v_booking.status,'paymentStatus','paid','paidAmount',v_booking.paid_amount_rub,'bonusSpent',v_booking.bonus_spent,'bonusEarned',coalesce((select amount_points from public.loyalty_transactions where booking_id=v_booking.id and kind='booking_accrual'),0));
  end if;

  v_paid := coalesce(p_paid_amount,v_booking.amount_due_rub);
  if v_paid < 0 or v_paid > 10000000 then raise exception 'INVALID_PAID_AMOUNT' using errcode='P0001'; end if;
  if char_length(trim(coalesce(p_payment_method,'')))<2 or char_length(p_payment_method)>120 then raise exception 'INVALID_PAYMENT_METHOD' using errcode='P0001'; end if;

  select * into v_res from public.loyalty_reservations where booking_id=v_booking.id and status='reserved' for update;
  if v_res.id is not null then
    insert into public.loyalty_transactions(client_id,booking_id,amount_points,kind,reason,created_by)
    values(v_booking.client_id,v_booking.id,-v_res.points,'booking_spend','Списание за оплаченную сессию','system')
    on conflict do nothing;
    update public.loyalty_reservations set status='spent',resolved_at=now() where id=v_res.id;
  end if;

  select * into v_settings from public.loyalty_settings where singleton=true;
  v_rpp := greatest(1,coalesce(v_settings.rubles_per_point,1));
  if coalesce(v_settings.enabled,false) and coalesce(v_settings.accrual_percent,0)>0 and v_paid>0 then
    v_earned := floor((v_paid * v_settings.accrual_percent / 100.0) / v_rpp)::integer;
    if v_earned>0 then
      insert into public.loyalty_transactions(client_id,booking_id,amount_points,kind,reason,created_by)
      values(v_booking.client_id,v_booking.id,v_earned,'booking_accrual','Начисление за оплаченную сессию','system')
      on conflict do nothing;
    end if;
  end if;

  update public.bookings set
    status='completed',payment_status='paid',paid_at=now(),paid_amount_rub=v_paid,
    payment_method=trim(p_payment_method),bonus_spent=coalesce(v_res.points,0),bonus_reserved=0
  where id=v_booking.id returning * into v_booking;

  return jsonb_build_object('id',v_booking.id,'status',v_booking.status,'paymentStatus',v_booking.payment_status,
    'paidAmount',v_booking.paid_amount_rub,'paymentMethod',v_booking.payment_method,
    'bonusSpent',v_booking.bonus_spent,'bonusEarned',v_earned,'loyaltyBalance',public.krug_loyalty_available(v_booking.client_id));
end;
$$;
revoke all on function public.krug_admin_settle_booking(text,uuid,integer,text) from public, authenticated;
grant execute on function public.krug_admin_settle_booking(text,uuid,integer,text) to anon;

create or replace function public.krug_admin_cancel_booking(p_token text,p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_booking public.bookings%rowtype;
  v_res public.loyalty_reservations%rowtype;
  v_after_start boolean;
begin
  if not private.krug_admin_token_valid(p_token) then raise exception 'ADMIN_UNAUTHORIZED' using errcode='P0001'; end if;
  select * into v_booking from public.bookings where id=p_booking_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND' using errcode='P0001'; end if;
  if v_booking.status='completed' then raise exception 'CANCELLATION_NOT_ALLOWED' using errcode='P0001'; end if;
  if v_booking.status='cancelled' then return jsonb_build_object('id',v_booking.id,'status','cancelled'); end if;
  v_after_start := now()>=v_booking.starts_at;
  select * into v_res from public.loyalty_reservations where booking_id=v_booking.id and status='reserved' for update;
  if v_res.id is not null then
    if v_after_start then
      insert into public.loyalty_transactions(client_id,booking_id,amount_points,kind,reason,created_by)
      values(v_booking.client_id,v_booking.id,-v_res.points,'booking_spend','Списание при отмене после начала сессии','system')
      on conflict do nothing;
      update public.loyalty_reservations set status='spent',resolved_at=now() where id=v_res.id;
    else
      update public.loyalty_reservations set status='refunded',resolved_at=now() where id=v_res.id;
    end if;
  end if;
  update public.bookings set status='cancelled',cancelled_at=now(),cancelled_after_start=v_after_start,
    bonus_reserved=0,bonus_spent=case when v_after_start then coalesce(v_res.points,0) else 0 end,
    amount_due_rub=case when v_after_start then amount_due_rub else price_rub end
  where id=v_booking.id returning * into v_booking;
  return jsonb_build_object('id',v_booking.id,'status',v_booking.status,'cancelledAfterStart',v_after_start,'bonusSpent',v_booking.bonus_spent,'amountDue',v_booking.amount_due_rub);
end;
$$;
revoke all on function public.krug_admin_cancel_booking(text,uuid) from public, authenticated;
grant execute on function public.krug_admin_cancel_booking(text,uuid) to anon;
