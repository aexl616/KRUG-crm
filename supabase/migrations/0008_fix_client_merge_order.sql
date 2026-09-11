-- Retire the external duplicate before copying legacy_crm_id to the app profile.
create or replace function public.krug_admin_merge_candidate(p_token text,p_candidate_id uuid)
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp
as $$
declare v_candidate public.client_merge_candidates%rowtype; v_app public.clients%rowtype; v_ext public.clients%rowtype; v_primary_snapshot jsonb; v_merged_snapshot jsonb;
begin
  if not private.krug_admin_token_valid(p_token) then raise exception 'ADMIN_UNAUTHORIZED' using errcode='P0001'; end if;
  select * into v_candidate from public.client_merge_candidates where id=p_candidate_id and status='pending' for update;
  if not found then raise exception 'MERGE_CANDIDATE_NOT_FOUND' using errcode='P0001'; end if;
  select * into v_app from public.clients where id=v_candidate.app_client_id and merged_into_client_id is null for update;
  select * into v_ext from public.clients where id=v_candidate.external_client_id and merged_into_client_id is null for update;
  if v_app.id is null or v_ext.id is null then raise exception 'MERGE_CLIENT_NOT_FOUND' using errcode='P0001'; end if;
  v_primary_snapshot:=to_jsonb(v_app); v_merged_snapshot:=to_jsonb(v_ext);

  update public.bookings set client_id=v_app.id where client_id=v_ext.id;
  update public.loyalty_transactions set client_id=v_app.id where client_id=v_ext.id;
  update public.clients set merged_into_client_id=v_app.id where id=v_ext.id;

  update public.clients set
    manual_origin=(v_app.manual_origin or v_ext.manual_origin),
    other_origin=(v_app.other_origin or v_ext.other_origin),
    first_studio_visit_at=case when v_app.first_studio_visit_at is null then v_ext.first_studio_visit_at when v_ext.first_studio_visit_at is null then v_app.first_studio_visit_at else least(v_app.first_studio_visit_at,v_ext.first_studio_visit_at) end,
    legacy_crm_id=coalesce(v_app.legacy_crm_id,v_ext.legacy_crm_id),
    phone=case when nullif(trim(v_app.phone),'') is null then v_ext.phone else v_app.phone end,
    telegram_username=coalesce(v_app.telegram_username,v_ext.telegram_username)
  where id=v_app.id;

  update public.client_merge_candidates set status='merged',resolved_at=now() where id=v_candidate.id;
  update public.client_merge_candidates set status='dismissed',resolved_at=now()
  where status='pending' and id<>v_candidate.id and (app_client_id=v_ext.id or external_client_id=v_ext.id or external_client_id=v_app.id);
  insert into public.client_merge_log(primary_client_id,merged_client_id,candidate_id,primary_snapshot,merged_snapshot,merged_by)
  values(v_app.id,v_ext.id,v_candidate.id,v_primary_snapshot,v_merged_snapshot,'crm');
  return jsonb_build_object('clientId',v_app.id,'mergedClientId',v_ext.id,'balance',public.krug_loyalty_balance(v_app.id));
end;
$$;
revoke all on function public.krug_admin_merge_candidate(text,uuid) from public, authenticated;
grant execute on function public.krug_admin_merge_candidate(text,uuid) to anon;
