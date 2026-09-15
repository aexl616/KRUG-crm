-- KRUG 0.11.6 — persist command-menu state and reuse command handlers for button input.
begin;

create or replace function public.krug_telegram_update(p_update_id bigint,p_user_id bigint,p_name text,p_username text,p_command text,p_blocked boolean default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare c clients; k text; changes jsonb; was_started boolean; is_started boolean;
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
 was_started:=c.telegram_started_at is not null;

 if p_command='/start' then
   k:=case when was_started then 'start_repeat' else 'welcome' end;
   update clients set telegram_started_at=coalesce(telegram_started_at,now()),telegram_blocked_at=null where id=c.id;
 elsif p_command='/hide_menu' then
   return jsonb_build_object('accepted',true,'hidden',true,'started_before',was_started,'started',was_started,'role',case when was_started then 'user' else 'guest' end);
 else
   k:='settings';
   changes:=case p_command
     when '/marketing_on' then '{"marketing_enabled":true}'::jsonb when '/marketing_off' then '{"marketing_enabled":false}'::jsonb
     when '/reminders_on' then '{"reminders_enabled":true}'::jsonb when '/reminders_off' then '{"reminders_enabled":false}'::jsonb
     when '/30m_on' then '{"reminder_30m_enabled":true}'::jsonb when '/30m_off' then '{"reminder_30m_enabled":false}'::jsonb else null end;
 end if;

 is_started:=was_started or p_command='/start';
 perform public.krug_telegram_preferences(p_user_id,changes);
 perform private.krug_tg_enqueue(c.id,k,'update:'||p_update_id);
 update telegram_notifications
 set context=context||jsonb_build_object('_command_menu',true,'_menu_started',is_started,'_menu_role',case when is_started then 'user' else 'guest' end)
 where event_key='update:'||p_update_id and status='pending';
 return jsonb_build_object('accepted',true,'kind',k,'command',p_command,'started_before',was_started,'started',is_started,'role',case when is_started then 'user' else 'guest' end);
end $$;

revoke all on function public.krug_telegram_update(bigint,bigint,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.krug_telegram_update(bigint,bigint,text,text,text,boolean) to service_role;

commit;
