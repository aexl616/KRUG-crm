# 0.12.0 — Telegram bot experience

The studio can manage bot messages and consent-based broadcasts from CRM. Booking changes enter a durable queue automatically, and Supabase Cron processes it without an open browser. Existing one-room exclusion, staff scheduling, payment and loyalty settlement rules remain in place.

## Implemented

- `POST /api/telegram/process?mode=webhook`: secret-header authentication, private chats only, persistent update deduplication, first and repeat `/start`, block/unblock events, preference commands.
- Booking receipt, confirmation, meaningful changes, studio/client cancellation, completion, 24h/2h reminders and optional 30m reminder. Reminder replacement on booking changes and backfill for existing future confirmed bookings. Moscow timezone in booking messages.
- Booking/manual loyalty accrual and reservation/ledger refunds. Notifications follow actual ledger events; this patch does not calculate or change bonuses.
- Mandatory booking events ignore the legacy `service_enabled` flag. Marketing is off by default and requires a recorded affirmative consent. Existing true values without evidence of consent are reset to false. Reminders default on, 30m off. `/settings` shows current values and commands; the signed Mini App preferences API also exists.
- CRM navigation → **Telegram** → notifications, templates, campaigns and clients. Uses the existing employee session; all management actions require owner/admin in SQL. No Mini App management key is required for this section.
- Editable title/body/button text/target, known placeholders, preview, length/URL validation, optimistic template versions. Plain Telegram text; user values are interpolated in one pass and never treated as HTML.
- Campaign drafts, audience count preview, custom/template content, now/later launch, idempotent draft creation and launch, recipient/content snapshots, status and sent/failed/skipped counters, explicit retries. Draft scheduling uses device-local input converted to UTC; booking times remain Moscow.
- Audience filters: all opted-in Telegram clients, registered Mini App users, actual visitors, plus CRM tag. Tags use the existing shared CRM snapshot and explicit `miniAppClientId`, client UUID or `legacy_crm_id` links, never name/phone guesses. Blocked, banned and merged clients are excluded; consent/block status is checked again before each send. New opt-ins after launch are not added to a campaign snapshot.
- Atomic `FOR UPDATE SKIP LOCKED` claims and lease tokens. Worker claims one message at a time, max 10 per invocation, stops claiming after 30 seconds, finishes within a configured 60-second window under normal response limits. Transactional messages have priority over campaigns.
- Telegram 429 retries use `retry_after`, max four attempts. 403 marks the recipient blocked. Network/5xx ambiguity and expired leases become `DELIVERY_UNCERTAIN`; they require an acknowledged manual retry because Telegram `sendMessage` has no idempotency key. A database failure after successful Telegram delivery never triggers automatic resend.
- Health response contains only safe bot/webhook fields; recent errors expose codes instead of raw provider messages, URLs or credentials. Client status pages show 100 clients at a time and allow test enqueueing.

## Files

- Database: `supabase/migrations/20260914165321_telegram_bot_experience.sql`.
- Server: `api/_lib/telegram.js`, `api/telegram/{admin,process}.js`, `api/bookings.js`, `api/bookings/cancel.js`, `vercel.json`.
- CRM: `telegram-content.js`, `telegram-notifications-management.js`, `telegram-management.css`, `index.html`.
- Setup: `scripts/setup-telegram.cjs`, `.gitignore`, this document and `docs/telegram-launch.md`.
- Tests: `tests/api/telegram.test.cjs`, `tests/api/telegram-cancel.test.cjs`, `tests/telegram-content.test.cjs`, `tests/telegram-browser.cjs`, `supabase/tests/telegram.test.cjs`, `.github/workflows/tests.yml`.

Removed: browser-driven queue polling, manual queue processing button, legacy key-based Telegram management endpoints and unawaited sends from booking HTTP responses. Existing public booking API files are reused; there are no new serverless entrypoints or tests under `api/`.

## Deploy and migration order

1. Review and deploy this branch to a staging project first. Do not register the production bot with a preview URL. Keep its production webhook unchanged during staging.
2. Before applying production SQL, pause any existing Telegram sender. Apply **only** `20260914165321_telegram_bot_experience.sql` after current 0.11.4 migrations. Check `supabase migration list` before `supabase db push`: the repository contains pre-existing legacy numbering, including two `0013` files; reconcile existing history rather than replaying the whole historical chain into production. The new migration is transactional and explicitly defines the formerly production-only notification behavior.
3. Configure the following server-only environment variables in **krug-crm**, then deploy the CRM code:
   - `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (or legacy `SUPABASE_SERVICE_ROLE_KEY`).
   - `TELEGRAM_BOT_TOKEN` and `TELEGRAM_AUTH_REQUIRED=1`.
   - `TELEGRAM_WEBHOOK_SECRET`: independent random URL-safe value, 32–256 characters.
   - `TELEGRAM_CRON_SECRET`: a different random secret, preferably 32 bytes or more.
   - `TELEGRAM_WEBHOOK_URL=https://krug-crm.vercel.app/api/telegram/process?mode=webhook`.
   - `TELEGRAM_MINI_APP_URL=https://krug-miniapp.vercel.app` (default).
4. In Supabase Vault, create/update two named secrets: `krug_telegram_worker_url` = `https://krug-crm.vercel.app/api/telegram/process`; `krug_telegram_cron_secret` = the exact value of `TELEGRAM_CRON_SECRET`. Use Vault UI; do not paste actual secrets into committed SQL, the chat or browser code.
5. The migration installs `pg_cron`/`pg_net` and registers `krug-telegram-worker` every minute when the extensions are available. If unavailable, it emits a notice and skips scheduler installation so local SQL tests still run. After enabling the extensions on Supabase, register the job as the database administrator:

   ```sql
   select cron.schedule('krug-telegram-worker', '* * * * *', 'select private.krug_tg_tick()');
   ```

   The tick reads Vault at execution time. With missing Vault values it makes no network request. The worker URL must be reachable by Supabase and not require Vercel deployment-protection login. Queue status in CRM must show a recent automatic run; a successful SQL cron tick alone does not prove HTTP delivery.
6. Supply bot token, webhook secret and webhook URL through the operator's environment and run `node scripts/setup-telegram.cjs`. It registers webhook and bot commands; it does not send a message, discard pending updates or print secrets. Keep Main Mini App configured in BotFather.
7. Verify with an explicitly chosen test client: `/start` twice, `/settings`, opt-in/out, CRM test-send, draft recipient count, one targeted test campaign, cancellation/confirmation/reminder and block/unblock. Never use a real all-client campaign as a smoke test. No Mini App frontend deployment is necessary for the bot preference commands.

## Verification

Local verification on 2026-09-14 passed: 86 Node test-runner entries in the combined CRM/API/Mini App suite, plus 2 new cancellation API tests (88 total; some legacy entries contain their own multi-case suites); 2 executable SQL migration/regression suites; Telegram UI at 390/1100 px, CRM staff schedules at 390/1100 px and Mini App booking lifecycle at 390/900 px. Telegram screenshots were visually inspected. JavaScript syntax checks and `git diff --check` passed. API entrypoint count remains 12. GitHub `main` was rechecked at `fcd1a2e4747e515bc770fdb54dc1731710272e62` before committing.

Run using Node 22+, and isolated test-only installations of PGlite 0.3.14 and Playwright 1.58.2 (no application dependencies added):

```text
node --test tests/api/*.test.cjs
node --test tests/*.test.cjs
node --test apps/miniapp/tests/*.test.cjs
node --test mini-app/tests/*.test.cjs
PGLITE_MODULE=<path-to-pglite> node --test supabase/tests/*.test.cjs
node tests/telegram-browser.cjs <path-to-playwright>
node tests/staff-schedule-browser.cjs <path-to-playwright>
node apps/miniapp/tests/browser.cjs <path-to-playwright>
```

The PGlite harness executes the migration chain and assertions against PostgreSQL/WASM; it substitutes only unavailable legacy password crypto fixtures. It does not simulate pg_cron, pg_net, Vault, real network delivery or deployment protection. Browser tests exercise the shipped scripts with intercepted API calls; no actual Telegram sends occur.

## Limits and rollout notes

- Tags are available only for explicitly linked clients whose tags have reached the shared CRM snapshot. Unsynced local tags and unlinked local clients do not participate. Segment and tag filters can be combined; tag membership is frozen at campaign launch.
- Marketing consent reset is intentional; clients must opt in through `/marketing_on` or the signed preferences API.
- With the default schedule, first responses may wait up to roughly one minute; large broadcasts take multiple worker invocations. Transactional queue work takes priority.
- Configuration/setup and live production verification must be completed during deployment. Local tests cannot establish that production Vault, webhook, bot permissions or Cron are working.
- Template changes affect pending lifecycle messages; campaign content is frozen at launch. Templates used for campaigns have no booking context, so booking-specific variables render as `—`.
- Snapshot counts are estimates until launch and delivery; later opt-outs/blocks appear as skipped. Retry of ambiguous delivery can duplicate a message and is explicitly acknowledged in CRM.
- To pause delivery, disable the `krug-telegram-worker` Cron job. Prefer forward fixes; do not drop notification history or roll back to the legacy sender after this migration.

References: [Telegram Bot API](https://core.telegram.org/bots/api), [Supabase Cron](https://supabase.com/docs/guides/cron/quickstart), [Vercel function duration](https://vercel.com/docs/functions/configuring-functions/duration).
