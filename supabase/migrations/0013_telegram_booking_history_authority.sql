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
