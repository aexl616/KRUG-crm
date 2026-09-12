# 0.9.0 — Mini App API source of truth

The canonical frontend is `apps/miniapp/`. Its existing live adapter now uses the booking API consistently: catalog/prices, availability, create, sync and cancel. `/mini-app/` redirects to it and preserves Telegram query/hash launch parameters; legacy demo files remain only as historical fixtures.

## Changes

- `data.js`: Telegram initData on booking requests; explicit input whitelist (no price, status or payment fields); request IDs cached before submission for response-loss recovery; server-only history/status/payment values; no offline fallback masquerading as synced history; storage failure does not turn successful creation into failure; conflict invalidates availability; cancellation uses a fresh server snapshot because its RPC returns a partial booking.
- `app.js`, `patch-pre.js`, `patch-post.js`, `account.js`: catalog-driven service cards, fresh catalog on home/retry, no forced 1,000 RUB price or device-clock status in connected mode, on-site payment text, reserved bonuses separate from spent bonuses, cancelled records remain in history.
- Tests: live-adapter contract tests replace obsolete demo assumptions in the canonical suite. Browser tests use intercepted API responses and cover create → server price → sync → cancel → history → expired auth/retry at 390px and 900px.
- Pages workflow: frontend patch paths now trigger the existing CRM-only Pages deployment. Its artifact and CRM data behavior are unchanged.

## Validation

- `node --test apps/miniapp/tests/*.test.cjs`: 13 passing tests.
- `node --test tests/*.test.cjs`: all 5 CRM test files pass (data store, finance, hourly, notifications, settings).
- `node apps/miniapp/tests/browser.cjs <external-playwright-path> [screenshot-directory]`: passes at both viewport widths, no page errors; screenshot inspected.
- Live health/catalog/availability endpoints: HTTP 200; health reports Telegram auth enforced and on-site-only payments. Sync with an unknown request ID and no Telegram header returns HTTP 401 TELEGRAM_AUTH_REQUIRED. No production bookings were created.

## Deployment and remaining boundaries

Commit to main triggers the existing GitHub Pages workflow for the CRM preview. Pages serves only the CRM root files; it does not host the APIs or Mini App. `apps/miniapp/config.js` continues to target `https://krug-crm.vercel.app`.

No database migration, backend authorization relaxation, payment UI or financial-state mutation endpoint is introduced. Settlement and completion remain staff operations in CRM. The request-ID sync API returns records for up to 50 saved request IDs on this device. Cross-device account history requires a separate authenticated backend history contract; clearing those IDs loses discovery, not server bookings.

The full production write flow requires a genuine Telegram launch session. Offline browser tests are not evidence of a real production booking or delivery to CRM. The CRM still uses its existing storage and sync mechanisms; full CRM-on-Supabase remains the next stage.
