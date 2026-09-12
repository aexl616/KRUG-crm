-- KRUG 0.9.2 — start a confirmed Mini App booking from the main CRM.

create or replace function public.krug_admin_start_booking(p_token text,p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare v_booking public.bookings%rowtype;
begin
  if not private.krug_admin_token_valid(p_token) then raise exception 'ADMIN_UNAUTHORIZED' using errcode='P0001'; end if;
  select * into v_booking from public.bookings where id=p_booking_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND' using errcode='P0001'; end if;
  if v_booking.status='confirmed' then
    update public.bookings set status='in_progress' where id=v_booking.id returning * into v_booking;
  elsif v_booking.status<>'in_progress' then
    raise exception 'STATUS_CHANGE_NOT_ALLOWED' using errcode='P0001';
  end if;
  return jsonb_build_object('id',v_booking.id,'status',v_booking.status);
end;
$$;

revoke all on function public.krug_admin_start_booking(text,uuid) from public, anon, authenticated;
grant execute on function public.krug_admin_start_booking(text,uuid) to service_role;
