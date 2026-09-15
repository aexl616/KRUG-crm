-- KRUG 0.11.5 — stop CRM/Mini App re-import loops and allow scheduled campaign cancellation.
begin;

-- False CRM copies created from Mini App profiles have this deterministic legacy id.
-- Keep the original row for audit history, but remove it from every active client list.
update public.clients duplicate
set merged_into_client_id=original.id,
    updated_at=now()
from public.clients original
where duplicate.merged_into_client_id is null
  and original.merged_into_client_id is null
  and original.registered_in_app is true
  and duplicate.legacy_crm_id='miniapp-client-'||original.id::text
  and duplicate.id<>original.id;

update public.client_merge_candidates candidate
set status='dismissed',
    resolved_at=coalesce(resolved_at,now())
where status='pending'
  and exists (
    select 1 from public.clients duplicate
    where duplicate.merged_into_client_id is not null
      and (candidate.app_client_id=duplicate.id or candidate.external_client_id=duplicate.id)
  );

create or replace function private.krug_tg_campaign_counters() returns void
language sql set search_path=public,pg_temp as $$
 update telegram_campaigns c set queued_count=s.total,sent_count=s.sent,failed_count=s.failed,skipped_count=s.skipped,
 status=case when s.remaining=0 then case when s.failed>0 then 'completed_with_errors' else 'completed' end
   when c.scheduled_at>now() then 'scheduled' else 'sending' end
 from (select campaign_id,count(*)::int total,count(*) filter(where status='sent')::int sent,
 count(*) filter(where status='failed')::int failed,count(*) filter(where status='skipped')::int skipped,
 count(*) filter(where status in ('pending','processing'))::int remaining from telegram_notifications where campaign_id is not null group by campaign_id) s
 where c.id=s.campaign_id and c.status not in ('draft','cancelled')
$$;

create or replace function public.krug_telegram_cancel_campaign(p_session uuid,p_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare actor crm_staff_users; campaign telegram_campaigns;
begin
  actor:=private.krug_crm_session_user(p_session);
  if actor.role not in ('owner','admin') then raise exception 'CRM_FORBIDDEN'; end if;

  select * into campaign from telegram_campaigns where id=p_id for update;
  if campaign.id is null then raise exception 'TELEGRAM_CAMPAIGN_NOT_FOUND'; end if;
  if campaign.status='cancelled' then return to_jsonb(campaign); end if;
  if campaign.status<>'scheduled' then raise exception 'TELEGRAM_CAMPAIGN_NOT_SCHEDULED'; end if;
  if exists(select 1 from telegram_notifications where campaign_id=p_id and status='processing') then
    raise exception 'TELEGRAM_CAMPAIGN_SENDING';
  end if;

  update telegram_notifications
  set status='cancelled',last_error=null,lease_token=null,lease_until=null
  where campaign_id=p_id and status='pending';
  update telegram_campaigns set status='cancelled' where id=p_id returning * into campaign;
  return to_jsonb(campaign);
end $$;

revoke all on function public.krug_telegram_cancel_campaign(uuid,uuid) from public,anon,authenticated;
grant execute on function public.krug_telegram_cancel_campaign(uuid,uuid) to service_role;

commit;
