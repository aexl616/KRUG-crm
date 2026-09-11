-- Fixed-start rental packages (for example 10:00–22:00 and 22:00–10:00)
-- must be checked as a single cross-day interval instead of being limited by
-- the regular daily closing hour.

create or replace function public.krug_available_slots(p_date date, p_duration_hours numeric, p_service_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_hours public.studio_hours%rowtype;
  v_service public.services%rowtype;
  v_candidate_local timestamp;
  v_candidate timestamptz;
  v_end timestamptz;
  v_slots jsonb := '[]'::jsonb;
  v_price integer;
  v_day smallint;
begin
  if p_date is null or p_duration_hours is null or p_duration_hours <= 0 or p_duration_hours > 12 then
    return jsonb_build_object('date', p_date, 'closed', true, 'slots', v_slots);
  end if;

  select * into v_service
  from public.services
  where id = p_service_id and active = true and legacy_only = false;

  if not found then
    return jsonb_build_object('date', p_date, 'closed', true, 'slots', v_slots);
  end if;

  v_day := extract(isodow from p_date)::smallint;
  select * into v_hours from public.studio_hours where day_of_week = v_day;
  if not found or v_hours.is_open = false then
    return jsonb_build_object('date', p_date, 'closed', true, 'slots', v_slots);
  end if;

  if v_service.fixed_start is not null then
    if v_service.default_duration_hours is null or p_duration_hours <> v_service.default_duration_hours then
      return jsonb_build_object(
        'date', p_date,
        'closed', false,
        'open', to_char(v_hours.opens_at, 'HH24:MI'),
        'close', to_char(v_hours.closes_at, 'HH24:MI'),
        'timezone', 'Europe/Moscow',
        'slots', v_slots
      );
    end if;

    v_candidate_local := p_date + v_service.fixed_start;
    v_candidate := v_candidate_local at time zone 'Europe/Moscow';
    v_end := v_candidate + make_interval(secs => (p_duration_hours * 3600)::double precision);

    if v_candidate > now() then
      v_price := public.krug_quote_price(p_service_id, p_duration_hours, v_service.fixed_start);
      if v_price is not null
        and not exists (
          select 1 from public.bookings b
          where b.status in ('request','confirmed','in_progress')
            and b.starts_at < v_end and b.ends_at > v_candidate
        )
        and not exists (
          select 1 from public.studio_blocks s
          where s.active = true
            and s.starts_at < v_end and s.ends_at > v_candidate
        )
      then
        v_slots := v_slots || to_jsonb(to_char(v_service.fixed_start, 'HH24:MI'));
      end if;
    end if;

    return jsonb_build_object(
      'date', p_date,
      'closed', false,
      'open', to_char(v_service.fixed_start, 'HH24:MI'),
      'close', to_char((v_candidate_local + make_interval(secs => (p_duration_hours * 3600)::double precision))::time, 'HH24:MI'),
      'timezone', 'Europe/Moscow',
      'slots', v_slots
    );
  end if;

  for v_candidate_local in
    select generate_series(
      p_date + v_hours.opens_at,
      (p_date + v_hours.closes_at) - make_interval(secs => (p_duration_hours * 3600)::double precision),
      interval '1 hour'
    )
  loop
    v_candidate := v_candidate_local at time zone 'Europe/Moscow';
    v_end := v_candidate + make_interval(secs => (p_duration_hours * 3600)::double precision);
    if v_candidate <= now() then continue; end if;

    v_price := public.krug_quote_price(p_service_id, p_duration_hours, v_candidate_local::time);
    if v_price is null then continue; end if;
    if exists (
      select 1 from public.bookings b
      where b.status in ('request','confirmed','in_progress')
        and b.starts_at < v_end and b.ends_at > v_candidate
    ) then continue; end if;
    if exists (
      select 1 from public.studio_blocks s
      where s.active = true
        and s.starts_at < v_end and s.ends_at > v_candidate
    ) then continue; end if;

    v_slots := v_slots || to_jsonb(to_char(v_candidate_local, 'HH24:MI'));
  end loop;

  return jsonb_build_object(
    'date', p_date,
    'closed', false,
    'open', to_char(v_hours.opens_at, 'HH24:MI'),
    'close', to_char(v_hours.closes_at, 'HH24:MI'),
    'timezone', 'Europe/Moscow',
    'slots', v_slots
  );
end;
$$;

revoke all on function public.krug_available_slots(date, numeric, text) from public;
grant execute on function public.krug_available_slots(date, numeric, text) to anon, authenticated;
