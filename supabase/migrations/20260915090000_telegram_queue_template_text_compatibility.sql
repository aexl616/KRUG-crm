-- 0.12.1 hotfix — templated Telegram queue rows intentionally keep text empty.
-- The worker renders lifecycle messages from telegram_templates by kind.
begin;

alter table public.telegram_notifications
  drop constraint if exists telegram_notifications_text_check;

alter table public.telegram_notifications
  add constraint telegram_notifications_text_check
  check (char_length(text) <= 4000);

commit;
