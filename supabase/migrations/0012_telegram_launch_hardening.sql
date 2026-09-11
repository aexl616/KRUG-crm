-- KRUG 0.5 Telegram launch hardening.
-- IMPORTANT: apply only after Vercel has SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY
-- and TELEGRAM_BOT_TOKEN, because sensitive RPCs become server-only.

revoke execute on function public.krug_register_app_client(bigint,text,text,text) from anon, authenticated;
grant execute on function public.krug_register_app_client(bigint,text,text,text) to service_role;

revoke execute on function public.krug_create_booking_v2(uuid,text,date,time,numeric,text,text,text,bigint,text) from anon, authenticated;
grant execute on function public.krug_create_booking_v2(uuid,text,date,time,numeric,text,text,text,bigint,text) to service_role;

revoke execute on function public.krug_create_booking_v3(uuid,text,date,time,numeric,text,text,text,bigint,text,boolean) from anon, authenticated;
grant execute on function public.krug_create_booking_v3(uuid,text,date,time,numeric,text,text,text,bigint,text,boolean) to service_role;

revoke execute on function public.krug_sync_bookings(uuid[]) from anon, authenticated;
grant execute on function public.krug_sync_bookings(uuid[]) to service_role;

revoke execute on function public.krug_cancel_booking(uuid) from anon, authenticated;
grant execute on function public.krug_cancel_booking(uuid) to service_role;

revoke execute on function public.krug_loyalty_snapshot(bigint) from anon, authenticated;
grant execute on function public.krug_loyalty_snapshot(bigint) to service_role;

revoke execute on function public.krug_admin_app_overview(text) from anon, authenticated;
grant execute on function public.krug_admin_app_overview(text) to service_role;

revoke execute on function public.krug_admin_set_loyalty_policy(text,numeric) from anon, authenticated;
grant execute on function public.krug_admin_set_loyalty_policy(text,numeric) to service_role;

revoke execute on function public.krug_admin_adjust_loyalty(text,uuid,integer,text) from anon, authenticated;
grant execute on function public.krug_admin_adjust_loyalty(text,uuid,integer,text) to service_role;

revoke execute on function public.krug_admin_set_ban(text,bigint,boolean,text) from anon, authenticated;
grant execute on function public.krug_admin_set_ban(text,bigint,boolean,text) to service_role;

revoke execute on function public.krug_admin_import_clients(text,jsonb) from anon, authenticated;
grant execute on function public.krug_admin_import_clients(text,jsonb) to service_role;

revoke execute on function public.krug_admin_merge_candidate(text,uuid) from anon, authenticated;
grant execute on function public.krug_admin_merge_candidate(text,uuid) to service_role;

revoke execute on function public.krug_admin_dismiss_merge(text,uuid) from anon, authenticated;
grant execute on function public.krug_admin_dismiss_merge(text,uuid) to service_role;

revoke execute on function public.krug_admin_bookings_overview(text) from anon, authenticated;
grant execute on function public.krug_admin_bookings_overview(text) to service_role;

revoke execute on function public.krug_admin_confirm_booking(text,uuid) from anon, authenticated;
grant execute on function public.krug_admin_confirm_booking(text,uuid) to service_role;

revoke execute on function public.krug_admin_settle_booking(text,uuid,integer,text) from anon, authenticated;
grant execute on function public.krug_admin_settle_booking(text,uuid,integer,text) to service_role;

revoke execute on function public.krug_admin_cancel_booking(text,uuid) from anon, authenticated;
grant execute on function public.krug_admin_cancel_booking(text,uuid) to service_role;
