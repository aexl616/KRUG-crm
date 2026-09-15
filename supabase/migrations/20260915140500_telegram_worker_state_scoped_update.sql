-- KRUG 0.12.1 — make queue claims compatible with production safe-update enforcement.
create or replace function public.krug_telegram_claim(p_limit integer default 25)
returns setof public.telegram_notifications
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare claimed_id uuid;
begin
 update private.telegram_worker_state set last_run_at=now() where singleton=true;
 -- A crashed sender may have reached Telegram: do not blindly redeliver an ambiguous send.
 update telegram_notifications set status='failed',last_error='DELIVERY_UNCERTAIN',lease_token=null,lease_until=null
 where status='processing' and lease_until<now();
 update telegram_notifications n set status='skipped',last_error='RECIPIENT_INELIGIBLE'
 where status='pending' and scheduled_at<=now() and not private.krug_tg_eligible(n);
 for claimed_id in
   select id from telegram_notifications where status='pending' and scheduled_at<=now()
   order by (campaign_id is not null),scheduled_at,id for update skip locked
   limit greatest(1,least(coalesce(p_limit,25),50))
 loop
   return query update telegram_notifications n
   set status='processing',attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes'
   where n.id=claimed_id returning n.*;
 end loop;
 perform private.krug_tg_campaign_counters();
end $$;

create or replace function public.krug_telegram_claim_one()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare n public.telegram_notifications;
begin
 update private.telegram_worker_state set last_run_at=now() where singleton=true;
 update public.telegram_notifications
 set status='failed',last_error='DELIVERY_UNCERTAIN',lease_token=null,lease_until=null
 where status='processing' and lease_until<now();
 update public.telegram_notifications q
 set status='skipped',last_error='RECIPIENT_INELIGIBLE'
 where q.status='pending' and q.scheduled_at<=now() and not private.krug_tg_eligible(q);

 select * into n
 from public.telegram_notifications
 where status='pending' and scheduled_at<=now()
 order by (campaign_id is not null),scheduled_at,id
 for update skip locked limit 1;

 if n.id is not null then
   update public.telegram_notifications q
   set status='processing',attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes'
   where q.id=n.id returning q.* into n;
 end if;
 perform private.krug_tg_campaign_counters();
 return case when n.id is null then null else to_jsonb(n) end;
end $$;
