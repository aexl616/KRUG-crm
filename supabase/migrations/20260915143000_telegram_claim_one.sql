-- KRUG 0.12.1 — scalar Telegram queue claim for PostgREST worker calls.
begin;

create or replace function public.krug_telegram_claim_one()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare n public.telegram_notifications;
begin
  update private.telegram_worker_state set last_run_at=now();

  -- Never blindly retry a message after an expired processing lease: Telegram
  -- may have accepted it even if our acknowledgement was lost.
  update public.telegram_notifications
  set status='failed',last_error='DELIVERY_UNCERTAIN',lease_token=null,lease_until=null
  where status='processing' and lease_until<now();

  update public.telegram_notifications q
  set status='skipped',last_error='RECIPIENT_INELIGIBLE'
  where q.status='pending' and q.scheduled_at<=now() and not private.krug_tg_eligible(q);

  with due as (
    select id
    from public.telegram_notifications
    where status='pending' and scheduled_at<=now()
    order by (campaign_id is not null),scheduled_at,id
    for update skip locked
    limit 1
  )
  update public.telegram_notifications q
  set status='processing',attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes'
  from due
  where q.id=due.id
  returning q.* into n;

  perform private.krug_tg_campaign_counters();
  return case when n.id is null then null else to_jsonb(n) end;
end $$;

revoke all on function public.krug_telegram_claim_one() from public,anon,authenticated;
grant execute on function public.krug_telegram_claim_one() to service_role;

commit;
