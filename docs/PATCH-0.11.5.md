# 0.11.5 — dedupe, schedule UX, booking safeguards and broadcasts

This patch completes the 0.11.5 product scope on top of the already deployed 0.11.4 schedules and 0.12.0 Telegram foundation.

## CRM and Mini App clients

- Mini App mirror rows are excluded before CRM client import.
- The API repeats the same check, so an older open CRM tab cannot restart the import loop.
- The production migration retires deterministic false copies whose legacy id is `miniapp-client-<real client id>`. It keeps the rows for audit history and hides them from active client views.

## Schedule and booking safety

- Day and week calendars display the complete 00:00–23:59 day on the page.
- The calendar has no nested vertical or horizontal scroll area. Booking details follow the calendar in the document flow.
- Confirm, cancel and delete controls are grouped with the booking actions.
- Cancellation requires the operator to type `ОТМЕНА`; deletion requires `УДАЛИТЬ`.
- Existing server rules for cancellation before or after start, settlement and loyalty reservations remain authoritative.

## Telegram broadcasts

- The separate **Рассылки** tab supports drafts, immediate or scheduled launch, audience preview and mass-send confirmation.
- Templates and campaigns support Telegram HTML formatting for bold, italic, underline, strike-through, code, quote and HTTPS links.
- Placeholder values are HTML-escaped. Unsupported tags, malformed nesting and unsafe links are rejected before storage or delivery.
- Scheduled campaigns can be cancelled before processing starts. Pending queue rows are cancelled atomically and remain available for campaign history.
- Telegram API `429 retry_after`, blocked users, partial failures, retries and campaign counters continue through the existing queue worker.
- Webhook, booking creation and staff booking transitions attempt one immediate queue delivery; Supabase Cron remains the durable fallback.

## Production migration

Apply `supabase/migrations/20260915180000_0115_dedupe_broadcasts.sql` after the existing Telegram worker migrations. It is transactional, preserves client history and adds a role-scoped campaign cancellation RPC available only to the service role.

## Validation

- Core application, finance, settings, notifications, API, Telegram content and worker regression tests.
- Production checks: migration recorded, false duplicate count becomes zero, cron remains healthy, and both Vercel projects deploy the same commit.
