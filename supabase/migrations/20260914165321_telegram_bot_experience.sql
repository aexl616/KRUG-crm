-- KRUG 0.12.0 — reproducible Telegram lifecycle, templates and campaigns.
begin;
-- Production 0.11.4 had checks not present in the historical repository schema.
alter table public.telegram_notifications drop constraint if exists telegram_notifications_status_check;
alter table public.telegram_notifications add constraint telegram_notifications_status_check
  check(status in ('pending','processing','sent','failed','cancelled','skipped'));
alter table public.telegram_campaigns drop constraint if exists telegram_campaigns_segment_check;
alter table public.telegram_campaigns add constraint telegram_campaigns_segment_check
  check(segment in ('all','app_registered','app_visited','miniapp','visited'));
alter table public.clients add column if not exists telegram_started_at timestamptz,
  add column if not exists telegram_blocked_at timestamptz;
alter table public.notification_preferences alter column marketing_enabled set default false;
alter table public.notification_preferences add column if not exists marketing_consented_at timestamptz,
  add column if not exists reminder_30m_enabled boolean not null default false;
-- The old default true was not evidence of explicit consent.
update public.notification_preferences set marketing_enabled=false where marketing_consented_at is null;
alter table public.telegram_notifications add column if not exists event_key text,
  add column if not exists context jsonb not null default '{}',
  add column if not exists lease_token uuid, add column if not exists lease_until timestamptz,
  add column if not exists button_target text not null default 'miniapp',
  add column if not exists telegram_message_id bigint;
drop index if exists public.telegram_notifications_booking_kind_uq;
create unique index if not exists telegram_notification_event_uq on public.telegram_notifications(event_key);
alter table public.telegram_campaigns add column if not exists title text not null default '',
  add column if not exists button_target text not null default 'miniapp',
  add column if not exists status text not null default 'draft',
  add column if not exists scheduled_at timestamptz,
  add column if not exists audience jsonb not null default '{"segment":"all"}',
  add column if not exists request_id uuid unique,
  add column if not exists created_by text,
  add column if not exists skipped_count integer not null default 0;
update public.telegram_campaigns set status='completed' where queued_count>0;

create table public.telegram_templates (
  kind text primary key, title text not null default '', body text not null,
  button_text text not null default 'Открыть КРУГ', button_target text not null default 'miniapp',
  button_url text not null default '', version integer not null default 1,
  updated_at timestamptz not null default now(), updated_by text
);
create table private.telegram_updates (update_id bigint primary key, received_at timestamptz not null default now());
create table private.telegram_worker_state (singleton boolean primary key default true check(singleton), last_run_at timestamptz);
insert into private.telegram_worker_state(singleton) values(true);
alter table public.telegram_templates enable row level security;
alter table private.telegram_updates enable row level security;
alter table private.telegram_worker_state enable row level security;
revoke all on public.telegram_templates from public,anon,authenticated;
revoke all on private.telegram_updates,private.telegram_worker_state from public,anon,authenticated;
grant select,insert,update,delete on public.telegram_templates,public.telegram_notifications,public.telegram_campaigns,public.notification_preferences to service_role;

insert into public.telegram_templates(kind,title,body) values
 ('welcome','Добро пожаловать в КРУГ','{client_name}, привет! Здесь можно записаться в студию и следить за своими сессиями. Открой приложение кнопкой ниже. /settings — настройки уведомлений.'),
 ('start_repeat','С возвращением в КРУГ','{client_name}, твои записи и бонусы — в приложении. /settings — настройки уведомлений.'),
 ('created','Заявка получена','{client_name}, получили заявку: {service}, {date} в {time}, {duration} ч. Дождись подтверждения студии.'),
 ('confirmed','Запись подтверждена','{service} — {date} в {time}, {duration} ч. Специалист: {staff}. Стоимость: {price} ₽.'),
 ('changed','Запись изменена','Актуальные данные: {service}, {date} в {time}, {duration} ч. Специалист: {staff}. Стоимость: {price} ₽.'),
 ('cancelled_studio','Запись отменена студией','{service}, {date} в {time}. Можно выбрать другое время в приложении.'),
 ('cancelled_client','Ты отменил запись','{service}, {date} в {time}. Будем рады увидеть тебя в другой день.'),
 ('reminder_24h','До записи 24 часа','{service} — {date} в {time}. Продолжительность: {duration} ч.'),
 ('reminder_2h','До записи 2 часа','{service} — сегодня в {time}. Ждём тебя в КРУГе.'),
 ('reminder_30m','До записи 30 минут','{service} — в {time}. До встречи!'),
 ('completed','Спасибо за сессию','{client_name}, сессия «{service}» завершена. Новая запись и баланс бонусов — в приложении.'),
 ('loyalty_accrual','Бонусы начислены','{client_name}, начислено {bonuses} бонусов. Баланс доступен в приложении.'),
 ('loyalty_refund','Бонусы возвращены','{client_name}, возвращено {bonuses} бонусов. Баланс доступен в приложении.'),
 ('campaign','Новости КРУГа','{client_name}, привет! Есть новости студии — загляни в приложение.'),
 ('test','Проверка связи','{client_name}, это тестовое сообщение от студии КРУГ.'),
 ('settings','Настройки уведомлений','События записи приходят автоматически. /marketing_on — включить новости; /marketing_off — отключить. /reminders_on и /reminders_off — напоминания. /30m_on и /30m_off — за 30 минут.');

create function private.krug_tg_validate(p jsonb) returns void language plpgsql set search_path=public,pg_temp as $$
declare s text; remainder text;
begin
 if jsonb_typeof(p)<>'object' or coalesce(length(trim(p->>'body')),0) not between 1 and 3000
   or length(coalesce(p->>'title',''))>160 or length(coalesce(p->>'button_text',''))>64
   or coalesce(p->>'button_target','miniapp') not in ('miniapp','url','none') then raise exception 'TELEGRAM_TEMPLATE_INVALID'; end if;
 if p->>'button_target'='url' and (coalesce(p->>'button_url','') !~ '^https://[^/@[:space:]]+([/:?#][^[:space:]]*)?$'
   or length(p->>'button_url')>1000 or p->>'button_url' ~ '[{}]') then raise exception 'TELEGRAM_BUTTON_INVALID'; end if;
 foreach s in array array[coalesce(p->>'title',''),p->>'body',coalesce(p->>'button_text','')] loop
   remainder:=regexp_replace(s,'\{(client_name|service|date|time|duration|staff|price|bonuses)\}','','g');
   if remainder ~ '[{}]' then raise exception 'TELEGRAM_PLACEHOLDER_INVALID'; end if;
 end loop;
end $$;

create function private.krug_tg_context(p_client uuid,p_booking uuid default null,p_bonuses integer default 0)
returns jsonb language sql stable set search_path=public,pg_temp as $$
 select jsonb_build_object('client_name',c.name,'service',coalesce(b.service_name_snapshot,'—'),
 'date',coalesce(to_char(b.starts_at at time zone 'Europe/Moscow','DD.MM.YYYY'),'—'),
 'time',coalesce(to_char(b.starts_at at time zone 'Europe/Moscow','HH24:MI'),'—'),
 'duration',coalesce((extract(epoch from b.ends_at-b.starts_at)/3600)::text,'—'),
 'staff',coalesce(b.staff_name_snapshot,'Не выбран'),'price',coalesce(b.price_rub::text,'—'),'bonuses',p_bonuses)
 from clients c left join bookings b on b.id=p_booking where c.id=p_client
$$;

create function private.krug_tg_enqueue(p_client uuid,p_kind text,p_key text,p_booking uuid default null,p_at timestamptz default now(),p_bonuses integer default 0)
returns void language plpgsql set search_path=public,pg_temp as $$
begin
 insert into telegram_notifications(client_id,booking_id,telegram_user_id,kind,text,event_key,context,scheduled_at)
 select c.id,p_booking,c.telegram_user_id,p_kind,'',p_key,private.krug_tg_context(c.id,p_booking,p_bonuses),p_at
 from clients c where c.id=p_client and c.telegram_user_id>0 and c.telegram_blocked_at is null and c.merged_into_client_id is null
 on conflict(event_key) do nothing;
end $$;

-- Replace the production-only legacy trigger without changing room/booking RPCs.
drop trigger if exists krug_booking_notifications_trg on public.bookings;
create function private.krug_tg_booking() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare k text; revision text:=gen_random_uuid()::text; r record; meaningful boolean;
begin
 if TG_OP='INSERT' then k:='created'; meaningful:=true;
 else
   meaningful:=row(new.status,new.starts_at,new.ends_at,new.service_id,new.staff_id,new.price_rub)
     is distinct from row(old.status,old.starts_at,old.ends_at,old.service_id,old.staff_id,old.price_rub);
   if not meaningful then return new; end if;
   if new.status is distinct from old.status then
     k:=case new.status when 'confirmed' then 'confirmed' when 'completed' then 'completed'
       when 'cancelled' then case when current_setting('krug.telegram_cancel_actor',true)='client' then 'cancelled_client' else 'cancelled_studio' end else null end;
   else k:='changed'; end if;
 end if;
 if k is not null then
   -- Assignment and bonus reservation happen in the creation transaction: refresh the receipt.
   if k='changed' and new.created_at=now() and exists(select 1 from telegram_notifications where event_key='created:'||new.id and status='pending') then
     update telegram_notifications set context=private.krug_tg_context(new.client_id,new.id) where event_key='created:'||new.id and status='pending';
   else
     perform private.krug_tg_enqueue(new.client_id,k,case when k='created' then 'created:'||new.id else new.id||':'||k||':'||revision end,new.id);
   end if;
 end if;
 update telegram_notifications set status='skipped',lease_token=null,lease_until=null,last_error='BOOKING_CHANGED'
   where booking_id=new.id and kind like 'reminder_%' and status in ('pending','processing');
 if new.status='confirmed' then
   for r in select * from (values ('reminder_24h',interval '24 hours'),('reminder_2h',interval '2 hours'),('reminder_30m',interval '30 minutes')) as t(kind,delta) loop
     if new.starts_at-r.delta>now() then
       perform private.krug_tg_enqueue(new.client_id,r.kind,new.id||':'||r.kind||':'||revision,new.id,new.starts_at-r.delta);
     end if;
   end loop;
 end if;
 return new;
end $$;
create trigger krug_booking_notifications_trg after insert or update on public.bookings for each row execute function private.krug_tg_booking();

create function private.krug_tg_loyalty() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if TG_TABLE_NAME='loyalty_reservations' then
   if new.status='refunded' and old.status is distinct from new.status then
     perform private.krug_tg_enqueue(new.client_id,'loyalty_refund','refund:'||new.id,new.booking_id,now(),new.points);
   end if;
 elsif new.amount_points>0 and new.kind in ('booking_accrual','manual_accrual','booking_refund') then
   perform private.krug_tg_enqueue(new.client_id,case when new.kind='booking_refund' then 'loyalty_refund' else 'loyalty_accrual' end,'loyalty:'||new.id,new.booking_id,now(),new.amount_points);
 end if;
 return new;
end $$;
create trigger krug_tg_loyalty_accrual after insert on public.loyalty_transactions for each row execute function private.krug_tg_loyalty();
create trigger krug_tg_loyalty_refund after update on public.loyalty_reservations for each row execute function private.krug_tg_loyalty();

create function public.krug_telegram_client_cancel(p_request_id uuid,p_telegram_user_id bigint) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if not exists(select 1 from bookings b join clients c on c.id=b.client_id where b.request_id=p_request_id and c.telegram_user_id=p_telegram_user_id) then raise exception 'BOOKING_NOT_FOUND'; end if;
 perform set_config('krug.telegram_cancel_actor','client',true);
 result:=public.krug_cancel_booking(p_request_id);
 perform set_config('krug.telegram_cancel_actor','',true);
 return result;
end $$;

create function public.krug_telegram_preferences(p_telegram_user_id bigint,p_changes jsonb default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare cid uuid; r notification_preferences;
begin
 select id into cid from clients where telegram_user_id=p_telegram_user_id and merged_into_client_id is null;
 if cid is null then raise exception 'CLIENT_NOT_FOUND'; end if;
 insert into notification_preferences(client_id,marketing_enabled) values(cid,false) on conflict do nothing;
 if p_changes is not null then
   if jsonb_typeof(p_changes)<>'object' or exists(select 1 from jsonb_each(p_changes) e where e.key not in ('marketing_enabled','reminders_enabled','reminder_30m_enabled') or jsonb_typeof(e.value)<>'boolean') then raise exception 'TELEGRAM_PREFERENCES_INVALID'; end if;
   update notification_preferences set
     marketing_enabled=coalesce((p_changes->>'marketing_enabled')::boolean,marketing_enabled),
     marketing_consented_at=case when p_changes->>'marketing_enabled'='true' then now() when p_changes->>'marketing_enabled'='false' then null else marketing_consented_at end,
     reminders_enabled=coalesce((p_changes->>'reminders_enabled')::boolean,reminders_enabled),
     reminder_30m_enabled=coalesce((p_changes->>'reminder_30m_enabled')::boolean,reminder_30m_enabled),updated_at=now() where client_id=cid;
 end if;
 select * into r from notification_preferences where client_id=cid;
 return jsonb_build_object('transactional_required',true,'marketing_enabled',r.marketing_enabled and r.marketing_consented_at is not null,
 'reminders_enabled',r.reminders_enabled,'reminder_30m_enabled',r.reminder_30m_enabled);
end $$;

create function public.krug_telegram_update(p_update_id bigint,p_user_id bigint,p_name text,p_username text,p_command text,p_blocked boolean default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare c clients; k text; changes jsonb;
begin
 insert into private.telegram_updates(update_id) values(p_update_id) on conflict do nothing;
 if not found then return '{"duplicate":true}'::jsonb; end if;
 if p_user_id is null or p_user_id<=0 then raise exception 'TELEGRAM_USER_INVALID'; end if;
 perform pg_advisory_xact_lock(hashtext('telegram:'||p_user_id));
 if p_blocked is not null then
   update clients set telegram_blocked_at=case when p_blocked then now() else null end where telegram_user_id=p_user_id;
   return '{"accepted":true}'::jsonb;
 end if;
 insert into clients(telegram_user_id,name,telegram_username) values(p_user_id,left(coalesce(nullif(trim(p_name),''),'Гость'),120),p_username)
 on conflict(telegram_user_id) do nothing;
 select * into c from clients where telegram_user_id=p_user_id for update;
 if p_command='/start' then
   k:=case when c.telegram_started_at is null then 'welcome' else 'start_repeat' end;
   update clients set telegram_started_at=coalesce(telegram_started_at,now()),telegram_blocked_at=null where id=c.id;
 else
   k:='settings';
   changes:=case p_command
     when '/marketing_on' then '{"marketing_enabled":true}'::jsonb when '/marketing_off' then '{"marketing_enabled":false}'::jsonb
     when '/reminders_on' then '{"reminders_enabled":true}'::jsonb when '/reminders_off' then '{"reminders_enabled":false}'::jsonb
     when '/30m_on' then '{"reminder_30m_enabled":true}'::jsonb when '/30m_off' then '{"reminder_30m_enabled":false}'::jsonb else null end;
 end if;
 perform public.krug_telegram_preferences(p_user_id,changes);
 perform private.krug_tg_enqueue(c.id,k,'update:'||p_update_id);
 return jsonb_build_object('accepted',true,'kind',k);
end $$;

create function private.krug_tg_eligible(n telegram_notifications) returns boolean language sql stable set search_path=public,pg_temp as $$
 select exists(select 1 from clients c left join notification_preferences p on p.client_id=c.id
 where c.id=n.client_id and c.telegram_user_id=n.telegram_user_id and c.telegram_blocked_at is null and c.merged_into_client_id is null
 and (n.campaign_id is null or (not c.is_banned and p.marketing_enabled and p.marketing_consented_at is not null))
 and (n.kind not like 'reminder_%' or (coalesce(p.reminders_enabled,true)
   and (n.kind<>'reminder_30m' or coalesce(p.reminder_30m_enabled,false))
   and exists(select 1 from bookings b where b.id=n.booking_id and b.status='confirmed' and b.starts_at>now()))))
$$;

create function private.krug_tg_campaign_counters() returns void language sql set search_path=public,pg_temp as $$
 update telegram_campaigns c set queued_count=s.total,sent_count=s.sent,failed_count=s.failed,skipped_count=s.skipped,
 status=case when s.remaining=0 then case when s.failed>0 then 'completed_with_errors' else 'completed' end
   when c.scheduled_at>now() then 'scheduled' else 'sending' end
 from (select campaign_id,count(*)::int total,count(*) filter(where status='sent')::int sent,
 count(*) filter(where status='failed')::int failed,count(*) filter(where status='skipped')::int skipped,
 count(*) filter(where status in ('pending','processing'))::int remaining from telegram_notifications where campaign_id is not null group by campaign_id) s
 where c.id=s.campaign_id and c.status<>'draft'
$$;

create function public.krug_telegram_claim(p_limit integer default 25) returns setof telegram_notifications
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 update private.telegram_worker_state set last_run_at=now();
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

create function public.krug_telegram_delivery_check(p_id uuid,p_lease uuid) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare n telegram_notifications;
begin
 select * into n from telegram_notifications where id=p_id and lease_token=p_lease and status='processing' and lease_until>now() for update;
 if n.id is null then return false; end if;
 if not private.krug_tg_eligible(n) then
   update telegram_notifications set status='skipped',last_error='RECIPIENT_INELIGIBLE',lease_token=null,lease_until=null where id=p_id;
   perform private.krug_tg_campaign_counters(); return false;
 end if;
 return true;
end $$;

create function public.krug_telegram_finish(p_id uuid,p_lease uuid,p_result text,p_code text default null,p_retry_after integer default 60,p_message_id bigint default null)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare n telegram_notifications;
begin
 select * into n from telegram_notifications where id=p_id and lease_token=p_lease and status='processing' for update;
 if n.id is null then return false; end if;
 if p_result not in ('sent','retry','failed','blocked') then raise exception 'TELEGRAM_RESULT_INVALID'; end if;
 if p_result='blocked' then update clients set telegram_blocked_at=now() where id=n.client_id; end if;
 update telegram_notifications set status=case when p_result='sent' then 'sent' when p_result='retry' and attempts<4 then 'pending' else 'failed' end,
 sent_at=case when p_result='sent' then now() else null end,telegram_message_id=p_message_id,
 last_error=case when p_result='sent' then null else left(regexp_replace(coalesce(p_code,'DELIVERY_FAILED'),'[^A-Z0-9_]','','g'),80) end,
 scheduled_at=case when p_result='retry' then now()+make_interval(secs=>greatest(1,least(p_retry_after,86400))) else scheduled_at end,
 lease_token=null,lease_until=null where id=p_id;
 perform private.krug_tg_campaign_counters(); return true;
end $$;

-- CRM tags remain in the existing shared snapshot. Join only explicit identity links.
create function private.krug_tg_client_tags(p_client uuid) returns table(tag text) language sql stable set search_path=public,pg_temp as $$
 select distinct e.value #>> '{}' from clients c cross join crm_shared_state s
 cross join lateral jsonb_array_elements(case when jsonb_typeof(s.data->'clients')='array' then s.data->'clients' else '[]' end) j
 cross join lateral jsonb_array_elements(case when jsonb_typeof(j->'tags')='array' then j->'tags' else '[]' end) e
 where c.id=p_client and (j->>'miniAppClientId'=c.id::text or j->>'id'=c.id::text or j->>'id'=c.legacy_crm_id)
 and jsonb_typeof(e.value)='string' and length(trim(e.value #>> '{}')) between 1 and 120
$$;

create function private.krug_tg_audience(p jsonb) returns setof clients language plpgsql stable set search_path=public,pg_temp as $$
begin
 if jsonb_typeof(p)<>'object' or coalesce(p->>'segment','all') not in ('all','miniapp','visited')
 or exists(select 1 from jsonb_object_keys(p) k where k not in ('segment','tag'))
 or (p ? 'tag' and (jsonb_typeof(p->'tag')<>'string' or length(p->>'tag')>120)) then raise exception 'TELEGRAM_AUDIENCE_INVALID'; end if;
 return query select c.* from clients c join notification_preferences n on n.client_id=c.id
 where c.telegram_user_id>0 and c.telegram_blocked_at is null and c.merged_into_client_id is null and not c.is_banned
 and n.marketing_enabled and n.marketing_consented_at is not null
 and (coalesce(p->>'tag','')='' or exists(select 1 from private.krug_tg_client_tags(c.id) t where t.tag=p->>'tag'))
 and (coalesce(p->>'segment','all')='all' or (p->>'segment'='miniapp' and c.registered_in_app)
 or (p->>'segment'='visited' and (c.first_studio_visit_at is not null or exists(select 1 from bookings b where b.client_id=c.id and b.status='completed'))));
end $$;

create function public.krug_telegram_admin(p_session uuid,p_action text,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare actor crm_staff_users; t telegram_templates; c telegram_campaigns; cid uuid; n integer; audience jsonb; content jsonb;
begin
 actor:=private.krug_crm_session_user(p_session);
 if actor.role not in ('owner','admin') then raise exception 'CRM_FORBIDDEN'; end if;
 if p_action='authorize' then return '{"authorized":true}'::jsonb;
 elsif p_action='overview' then
   perform private.krug_tg_campaign_counters();
   return jsonb_build_object('pending',(select count(*) from telegram_notifications where status in ('pending','processing')),
    'failed',(select count(*) from telegram_notifications where status='failed'),'sent',(select count(*) from telegram_notifications where status='sent'),
    'last_run_at',(select last_run_at from private.telegram_worker_state),
    'last_update_at',(select max(received_at) from private.telegram_updates),
    'errors',coalesce((select jsonb_agg(to_jsonb(x)) from (select id,client_id,kind,status,
      case when last_error ~ '^[A-Z0-9_]{1,80}$' then last_error else 'LEGACY_DELIVERY_ERROR' end last_error,
      attempts,created_at from telegram_notifications where last_error is not null order by created_at desc limit 30)x),'[]'::jsonb),
    'templates',(select jsonb_agg(to_jsonb(x) order by kind) from telegram_templates x),
    'campaigns',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from telegram_campaigns order by created_at desc limit 30)x),'[]'::jsonb),
    'clients',coalesce((select jsonb_agg(to_jsonb(x)) from (select cl.id,cl.name,cl.telegram_user_id,cl.telegram_started_at,cl.telegram_blocked_at,
      coalesce(p.marketing_enabled and p.marketing_consented_at is not null,false) marketing_enabled,
      coalesce(p.reminders_enabled,true) reminders_enabled from clients cl left join notification_preferences p on p.client_id=cl.id
      where cl.telegram_user_id is not null and cl.merged_into_client_id is null order by cl.name,cl.id limit 100 offset greatest(0,coalesce((p_payload->>'offset')::integer,0)))x),'[]'::jsonb),
    'audience_segments','["all","miniapp","visited"]'::jsonb,
    'tags',coalesce((select jsonb_agg(tag order by tag) from (select distinct tt.tag from clients cl cross join lateral private.krug_tg_client_tags(cl.id) tt where cl.telegram_user_id is not null and cl.merged_into_client_id is null) tags),'[]'::jsonb));
 elsif p_action='saveTemplate' then
   content:=p_payload->'content'; perform private.krug_tg_validate(content);
   update telegram_templates set title=coalesce(content->>'title',''),body=content->>'body',button_text=coalesce(content->>'button_text',''),
     button_target=coalesce(content->>'button_target','miniapp'),button_url=coalesce(content->>'button_url',''),version=version+1,updated_at=now(),updated_by=actor.user_id
   where kind=p_payload->>'kind' and version=(p_payload->>'version')::integer returning * into t;
   if t.kind is null then raise exception 'TELEGRAM_TEMPLATE_CONFLICT'; end if;
   return to_jsonb(t);
 elsif p_action='previewAudience' then
   select count(*) into n from private.krug_tg_audience(coalesce(p_payload->'audience','{}'));
   return jsonb_build_object('count',n);
 elsif p_action='saveCampaign' then
   content:=p_payload->'content'; perform private.krug_tg_validate(content);
   audience:=coalesce(p_payload->'audience','{}'); perform 1 from private.krug_tg_audience(audience);
   if p_payload->>'request_id' is null then raise exception 'TELEGRAM_REQUEST_ID_REQUIRED'; end if;
   insert into telegram_campaigns(request_id,title,message,button_text,button_target,button_url,audience,segment,created_by,scheduled_at)
   values((p_payload->>'request_id')::uuid,coalesce(content->>'title',''),content->>'body',coalesce(content->>'button_text',''),
     coalesce(content->>'button_target','miniapp'),coalesce(content->>'button_url',''),audience,coalesce(audience->>'segment','all'),actor.user_id,(nullif(p_payload->>'scheduled_at',''))::timestamptz)
   on conflict(request_id) do nothing returning * into c;
   if c.id is null then select * into c from telegram_campaigns where request_id=(p_payload->>'request_id')::uuid; end if;
   return to_jsonb(c);
 elsif p_action='launchCampaign' then
   select * into c from telegram_campaigns where id=(p_payload->>'id')::uuid for update;
   if c.id is null then raise exception 'TELEGRAM_CAMPAIGN_NOT_FOUND'; end if;
   if c.status<>'draft' then return to_jsonb(c); end if;
   c.scheduled_at:=coalesce((nullif(p_payload->>'scheduled_at',''))::timestamptz,now());
   if c.scheduled_at>now()+interval '1 year' or c.scheduled_at<now()-interval '5 minutes' then raise exception 'TELEGRAM_SCHEDULE_INVALID'; end if;
   insert into telegram_notifications(client_id,campaign_id,telegram_user_id,kind,text,button_text,button_target,button_url,scheduled_at,event_key,context)
   select a.id,c.id,a.telegram_user_id,'campaign',concat_ws(E'\n\n',nullif(c.title,''),c.message),c.button_text,c.button_target,c.button_url,c.scheduled_at,
     'campaign:'||c.id||':'||a.id,private.krug_tg_context(a.id)||jsonb_build_object('_content',jsonb_build_object(
       'title',c.title,'body',c.message,'button_text',c.button_text,'button_target',c.button_target,'button_url',c.button_url))
   from private.krug_tg_audience(c.audience) a;
   get diagnostics n=row_count;
   update telegram_campaigns set status=case when n=0 then 'completed' when c.scheduled_at>now() then 'scheduled' else 'sending' end,
    scheduled_at=c.scheduled_at,queued_count=n where id=c.id returning * into c;
   return to_jsonb(c);
 elsif p_action='retry' then
   -- Explicit retry can duplicate an ambiguous delivery; the UI requires acknowledgement.
   update telegram_notifications set status='pending',attempts=0,scheduled_at=now(),last_error=null
    where status='failed' and (id=(p_payload->>'id')::uuid or campaign_id=(p_payload->>'campaign_id')::uuid)
    and (last_error is distinct from 'DELIVERY_UNCERTAIN' or p_payload->>'acknowledge_uncertain'='true');
   get diagnostics n=row_count; perform private.krug_tg_campaign_counters(); return jsonb_build_object('retried',n);
 elsif p_action='testSend' then
   cid:=(p_payload->>'client_id')::uuid;
   if not exists(select 1 from clients where id=cid and telegram_user_id>0 and telegram_blocked_at is null and merged_into_client_id is null) then raise exception 'TELEGRAM_CLIENT_UNAVAILABLE'; end if;
   perform private.krug_tg_enqueue(cid,'test','test:'||gen_random_uuid()); return '{"queued":true}'::jsonb;
 else raise exception 'TELEGRAM_ACTION_INVALID'; end if;
end $$;

-- Close legacy key-based campaign/overview APIs, including production-only functions.
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('krug_admin_create_campaign','krug_admin_notifications_overview') loop
   execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
 end loop;
 for f in select p.oid::regprocedure signature,n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where (n.nspname='public' and p.proname like 'krug_telegram_%') or (n.nspname='private' and p.proname like 'krug_tg_%') loop
   execute format('revoke all on function %s from public,anon,authenticated',f.signature);
   if f.nspname='public' then execute format('grant execute on function %s to service_role',f.signature); end if;
 end loop;
end $$;

-- Resume reminders for existing confirmed bookings without replaying past lifecycle events.
do $$ declare b record; r record; begin
 for b in select id,client_id,starts_at from bookings where status='confirmed' and starts_at>now() loop
   update telegram_notifications set status='skipped',last_error='REMINDER_MIGRATED' where booking_id=b.id and kind like 'reminder%' and status='pending';
   for r in select * from (values ('reminder_24h',interval '24 hours'),('reminder_2h',interval '2 hours'),('reminder_30m',interval '30 minutes')) t(kind,delta) loop
     if b.starts_at-r.delta>now() then perform private.krug_tg_enqueue(b.client_id,r.kind,'0.12:'||b.id||':'||r.kind,b.id,b.starts_at-r.delta); end if;
   end loop;
 end loop;
end $$;

-- Supabase Cron drives the existing endpoint; no additional Vercel function or daily Hobby cron.
-- Vault values are provisioned separately. Missing configuration never sends an HTTP request.
create function private.krug_tg_tick() returns boolean language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare endpoint text; secret text;
begin
 if to_regclass('vault.decrypted_secrets') is null then return false; end if;
 execute 'select decrypted_secret from vault.decrypted_secrets where name=$1 limit 1' into endpoint using 'krug_telegram_worker_url';
 execute 'select decrypted_secret from vault.decrypted_secrets where name=$1 limit 1' into secret using 'krug_telegram_cron_secret';
 if endpoint is null or secret is null or endpoint !~ '^https://[^/@[:space:]]+/api/telegram/process$' then return false; end if;
 execute 'select net.http_post(url:=$1,headers:=$2,body:=$3,timeout_milliseconds:=120000)'
 using endpoint,jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||secret),'{}'::jsonb;
 return true;
end $$;
revoke all on function private.krug_tg_tick() from public,anon,authenticated,service_role;
do $$ begin
 if exists(select 1 from pg_available_extensions where name='pg_cron') and exists(select 1 from pg_available_extensions where name='pg_net') then
   execute 'create extension if not exists pg_cron';
   execute 'create extension if not exists pg_net';
   perform 1 from pg_namespace where nspname='cron';
   execute $sql$select cron.schedule('krug-telegram-worker','* * * * *','select private.krug_tg_tick()')$sql$;
 else raise notice 'Install Supabase pg_cron and pg_net to enable automatic Telegram processing'; end if;
end $$;
commit;
