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
    'telegramUserId',c.telegram_user_id,'serviceId',b.service_id,'serviceName',b.service_name_snapshot,
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
