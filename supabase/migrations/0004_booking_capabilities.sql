-- KRUG 0.4.3 capability-style booking sync/cancel for the test phase.
-- request_id acts as an unguessable per-booking capability until Telegram auth is wired.

create or replace function public.krug_sync_bookings(p_request_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if p_request_ids is null or coalesce(array_length(p_request_ids,1),0)=0 then return '[]'::jsonb; end if;
  if array_length(p_request_ids,1)>50 then raise exception 'TOO_MANY_REQUEST_IDS' using errcode='P0001'; end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',b.id,
      'requestId',b.request_id,
      'serviceId',b.service_id,
      'serviceName',b.service_name_snapshot,
      'date',to_char(b.starts_at at time zone 'Europe/Moscow','YYYY-MM-DD'),
      'startTime',to_char(b.starts_at at time zone 'Europe/Moscow','HH24:MI'),
      'durationHours',extract(epoch from (b.ends_at-b.starts_at))/3600,
      'price',b.price_rub,
      'amountDue',b.amount_due_rub,
      'status',b.status,
      'paymentStatus',b.payment_status,
      'paymentMode','on_site_only',
      'cancelledAt',b.cancelled_at,
      'cancelledAfterStart',b.cancelled_after_start,
      'createdAt',b.created_at
    ) order by b.starts_at desc
  ),'[]'::jsonb)
  into v_result
  from public.bookings b
  where b.request_id=any(p_request_ids);

  return v_result;
end;
$$;

revoke all on function public.krug_sync_bookings(uuid[]) from public;
grant execute on function public.krug_sync_bookings(uuid[]) to anon, authenticated;

create or replace function public.krug_cancel_booking(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_booking public.bookings%rowtype;
begin
  if p_request_id is null then raise exception 'INVALID_REQUEST_ID' using errcode='P0001'; end if;

  select * into v_booking
  from public.bookings
  where request_id=p_request_id
  for update;

  if not found then raise exception 'BOOKING_NOT_FOUND' using errcode='P0001'; end if;

  if v_booking.status='cancelled' then
    return jsonb_build_object('id',v_booking.id,'requestId',v_booking.request_id,'status',v_booking.status,'cancelledAt',v_booking.cancelled_at,'cancelledAfterStart',v_booking.cancelled_after_start);
  end if;

  if v_booking.status not in ('request','confirmed') then raise exception 'CANCELLATION_NOT_ALLOWED' using errcode='P0001'; end if;
  if now()>=v_booking.starts_at then raise exception 'CANCELLATION_AFTER_START' using errcode='P0001'; end if;

  update public.bookings
  set status='cancelled',cancelled_at=now(),cancelled_after_start=false
  where id=v_booking.id
  returning * into v_booking;

  return jsonb_build_object('id',v_booking.id,'requestId',v_booking.request_id,'status',v_booking.status,'cancelledAt',v_booking.cancelled_at,'cancelledAfterStart',v_booking.cancelled_after_start);
end;
$$;

revoke all on function public.krug_cancel_booking(uuid) from public;
grant execute on function public.krug_cancel_booking(uuid) to anon, authenticated;
