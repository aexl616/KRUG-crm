-- KRUG 0.6 — Telegram service notifications, reminders and campaigns.
-- Applied to production on 2026-09-12. Kept here so repository migrations match live schema.

create table if not exists public.notification_preferences (
  client_id uuid primary key references public.clients(id) on delete cascade,
  service_enabled boolean not null default true,
  reminders_enabled boolean not null default true,
  marketing_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.notification_preferences enable row level security;
revoke all on public.notification_preferences from anon, authenticated;

create table if not exists public.telegram_campaigns (
  id uuid primary key default gen_random_uuid(), message text not null,
  segment text not null default 'all', button_text text, button_url text,
  queued_count integer not null default 0, sent_count integer not null default 0,
  failed_count integer not null default 0, created_at timestamptz not null default now()
);
alter table public.telegram_campaigns enable row level security;
revoke all on public.telegram_campaigns from anon, authenticated;

create table if not exists public.telegram_notifications (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete cascade,
  campaign_id uuid references public.telegram_campaigns(id) on delete cascade,
  telegram_user_id bigint not null, kind text not null, text text not null,
  button_text text, button_url text, scheduled_at timestamptz not null default now(),
  status text not null default 'pending', attempts integer not null default 0,
  sent_at timestamptz, last_error text, created_at timestamptz not null default now()
);
create index if not exists telegram_notifications_due_idx on public.telegram_notifications(status,scheduled_at);
create unique index if not exists telegram_notifications_booking_kind_uq on public.telegram_notifications(booking_id,kind) where booking_id is not null;
alter table public.telegram_notifications enable row level security;
revoke all on public.telegram_notifications from anon, authenticated;

-- Functions krug_enqueue_booking_notifications, krug_admin_create_campaign,
-- krug_admin_notifications_overview and trigger krug_booking_notifications_trg
-- are defined in the production migration of the same patch.
