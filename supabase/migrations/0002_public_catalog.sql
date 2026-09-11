-- KRUG 0.4 public service catalog and read-only Data API access.
-- Values mirror the current CRM catalog. The Mini App reads them through /api/services.

alter table public.services
  add column if not exists pricing_rules jsonb not null default '{}'::jsonb;

alter function public.set_updated_at() set search_path = public;
create index if not exists bookings_service_starts_at_idx on public.bookings (service_id, starts_at);

grant select on table public.services to anon, authenticated;
grant select on table public.service_price_tiers to anon, authenticated;

create policy services_public_read
on public.services for select to anon, authenticated
using (active = true and public_visible = true);

create policy service_price_tiers_public_read
on public.service_price_tiers for select to anon, authenticated
using (exists (
  select 1 from public.services s
  where s.id = service_price_tiers.service_id
    and s.active = true
    and s.public_visible = true
));

insert into public.services
  (id,name,public_name,description,public_description,pricing_type,public_category,public_visible,active,legacy_only,select_duration,min_duration_hours,default_duration_hours,fixed_start,sort_order,pricing_rules)
values
  ('recording','Запись','Запись','Запись звука в студии.','Запись в студии КРУГ.','hourly','primary',true,true,false,true,1,null,null,10,'{"regular":{"extraHour":1200},"morning":{"start":"09:00","end":"15:00","extraHour":1000}}'::jsonb),
  ('recording-mix','Запись + сведение','Запись + сведение','Запись звука и сведение в одном формате.','Запись и сведение в студии КРУГ.','hourly','primary',true,true,false,true,1,null,null,20,'{}'::jsonb),
  ('rental','Аренда','Аренда','Студия для самостоятельной работы.','Аренда студии КРУГ.','hourly','primary',true,true,false,true,1,null,null,30,'{}'::jsonb),
  ('rental-day','Аренда · 12 часов · День','Аренда · День','Дневной пакет аренды.','12 часов · 10:00–22:00','fixed','rental_package',false,true,false,false,12,12,'10:00',31,'{}'::jsonb),
  ('rental-night','Аренда · 12 часов · Ночь','Аренда · Ночь','Ночной пакет аренды.','12 часов · 22:00–10:00','fixed','rental_package',false,true,false,false,12,12,'22:00',32,'{}'::jsonb),
  ('studio-mixing','Сведение на студии','Сведение на студии','Сведение в студии КРУГ.','Работа в студии КРУГ.','minimum','other',true,true,false,true,2,2,null,40,'{}'::jsonb),
  ('studio-beatmaking','Битмейкинг на студии','Битмейкинг на студии','Написание бита в студии КРУГ.','Работа в студии КРУГ.','minimum','other',true,true,false,true,1,1,null,50,'{}'::jsonb),
  ('studio-mix-master','Сведение + мастер на студии','Сведение + мастер на студии','Почасовая работа по сведению и мастерингу в студии.','3 000 ₽/час','hourly','other',true,true,false,true,2,null,null,60,'{"hourlyRate":3000}'::jsonb)
on conflict (id) do update set
  name=excluded.name, public_name=excluded.public_name, description=excluded.description,
  public_description=excluded.public_description, pricing_type=excluded.pricing_type,
  public_category=excluded.public_category, public_visible=excluded.public_visible,
  active=excluded.active, legacy_only=excluded.legacy_only, select_duration=excluded.select_duration,
  min_duration_hours=excluded.min_duration_hours, default_duration_hours=excluded.default_duration_hours,
  fixed_start=excluded.fixed_start, sort_order=excluded.sort_order,
  pricing_rules=excluded.pricing_rules, updated_at=now();

insert into public.service_price_tiers
  (service_id,period_key,duration_hours,total_price_rub,starts_at,ends_at)
values
  ('recording','regular',1,1200,null,null),
  ('recording','regular',3,3300,null,null),
  ('recording','regular',5,5200,null,null),
  ('recording','morning',1,1000,'09:00','15:00'),
  ('recording','morning',3,2800,'09:00','15:00'),
  ('recording','morning',5,4400,'09:00','15:00'),
  ('recording-mix','regular',1,1800,null,null),
  ('recording-mix','regular',2,3600,null,null),
  ('recording-mix','regular',3,4800,null,null),
  ('recording-mix','regular',4,6000,null,null),
  ('recording-mix','regular',5,7200,null,null),
  ('recording-mix','regular',6,8400,null,null),
  ('rental','regular',1,1000,null,null),
  ('rental','regular',3,2800,null,null),
  ('rental','regular',5,4400,null,null),
  ('rental','regular',8,6500,null,null),
  ('rental-day','regular',12,9000,null,null),
  ('rental-night','regular',12,7500,null,null),
  ('studio-mixing','regular',2,4000,null,null),
  ('studio-beatmaking','regular',1,5000,null,null),
  ('studio-mix-master','regular',2,6000,null,null),
  ('studio-mix-master','regular',3,9000,null,null),
  ('studio-mix-master','regular',4,12000,null,null),
  ('studio-mix-master','regular',5,15000,null,null),
  ('studio-mix-master','regular',6,18000,null,null),
  ('studio-mix-master','regular',7,21000,null,null),
  ('studio-mix-master','regular',8,24000,null,null)
on conflict (service_id,period_key,duration_hours) do update set
  total_price_rub=excluded.total_price_rub,
  starts_at=excluded.starts_at,
  ends_at=excluded.ends_at,
  updated_at=now();
