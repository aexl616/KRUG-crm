# 0.11.6 — Telegram bot command buttons

## Existing command mapping

| Slash command | Button | Roles |
| --- | --- | --- |
| `/start` | Старт | guest, user, owner, admin; button only before first start |
| `/settings` | Настройки | user, owner, admin |
| `/marketing_on` | Новости: включить | user, owner, admin |
| `/marketing_off` | Новости: выключить | user, owner, admin |
| `/reminders_on` | Напоминания: включить | user, owner, admin |
| `/reminders_off` | Напоминания: выключить | user, owner, admin |
| `/30m_on` | За 30 минут: включить | user, owner, admin |
| `/30m_off` | За 30 минут: выключить | user, owner, admin |

The current bot has no owner/admin-only slash commands. The keyboard builder filters every command by role, so a restricted button cannot appear for a regular user when privileged handlers are added later.

## Behavior

- Button labels and slash input resolve to the same canonical command before the existing database handler runs.
- Slash commands remain available for manual input, compatibility and diagnostics.
- The persistent Reply Keyboard contains every command available to the current role plus **Скрыть меню**.
- Before the first successful `/start`, the server reports the client as `guest` and the menu contains **Старт**. The database `clients.telegram_started_at` field remains the source of truth.
- The successful first start sets `telegram_started_at`; all later keyboards omit **Старт**. A manually typed `/start` still produces the existing repeat-start response.
- **Помощь** opens `https://telegra.ph/Voprosy-i-Otvety-09-15` and **Поддержка** opens the configured Telegram support account through direct inline URL buttons.
- Change the support destination through `TELEGRAM_SUPPORT_USERNAME`. The safe default is `ae_xl`. `TELEGRAM_FAQ_URL` may override the FAQ URL with another HTTPS address.
- Existing Mini App and lifecycle notification logic is unchanged.

## Migration

Apply `supabase/migrations/20260915183000_0116_telegram_command_buttons.sql` after 0.11.5. It replaces only the existing update RPC, keeps update deduplication, and adds menu metadata to command response queue rows.
