-- Booking creation must go through krug_create_booking_v2 so app registration and the Telegram blocklist cannot be bypassed.
revoke execute on function public.krug_create_booking(uuid,text,date,time,numeric,text,text,text,bigint,text) from anon, authenticated, public;
