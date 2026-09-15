-- KRUG 0.12.1 — scope the worker heartbeat update for safe-update enforcement.
create or replace function public.krug_telegram_claim(p_limit integer default 25)
returns setof public.telegram_notifications
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
 update private.telegram_worker_state set last_run_at=now() where singleton=true;
 -- A crashed sender may have reached Telegram: do not blindly redeliver an ambiguous send.
 update telegram_notifications set status='failed',last_error='DELIVERY_UNCERTAIN',lease_token=null,lease_until=null
 where status='processing' and lease_until<now();
 update telegram_notifications n set status='skipped',last_error='RECIPIENT_INELIGIBLE'
 where status='pending' and scheduled_at<=now() and not private.krug_tg_eligible(n);
 return query with due as (
   select id from telegram_notifications where status='pending' and scheduled_at<=now()
   order by (campaign_id is not null),scheduled_at,id for update skip locked limit greatest(1,least(coalesce(p_limit,25),50))
 ) update telegram_notifications n set status='processing',attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes'
 from due where n.id=due.id returning n.*;
 perform private.krug_tg_campaign_counters();
end $$;
