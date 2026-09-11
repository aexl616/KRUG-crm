# КРУГ Mini App — запуск в Telegram

Production URL: `https://krug-miniapp.vercel.app`

Backend: `https://krug-crm.vercel.app/api/*`

## 1. BotFather

1. Создать отдельного бота КРУГ или выбрать существующего.
2. В `@BotFather` открыть `/mybots` → нужный бот → **Bot Settings** → **Configure Mini App** → **Enable Mini App**.
3. Настроить **Main Mini App** и указать production URL: `https://krug-miniapp.vercel.app`.
4. Не отключать защиту origin Mini App.
5. При желании настроить Splash Screen, иконку, описание и preview media.
6. Сохранить bot token локально. Не добавлять его в GitHub и не отправлять в чат.

## 2. Vercel environment variables — `krug-crm`

Добавить только в backend-проект `krug-crm`:

- `TELEGRAM_BOT_TOKEN` — токен бота из BotFather.
- `SUPABASE_SECRET_KEY` — server-side secret key Supabase. Если проект использует legacy keys, вместо него допустим `SUPABASE_SERVICE_ROLE_KEY`.
- `TELEGRAM_AUTH_REQUIRED=1` — включать последним, после добавления двух секретов.

Секретные переменные нельзя использовать в browser/public-prefixed env vars и нельзя помещать в код репозитория.

После изменения env выполнить production redeploy `krug-crm`.

## 3. Database hardening

После того как backend health показывает, что Supabase server secret и Telegram bot token доступны, применить миграцию:

`supabase/migrations/0012_telegram_launch_hardening.sql`

Она закрывает чувствительные Supabase RPC от anon/authenticated и оставляет их только server-side роли. До настройки server secret эту миграцию не применять.

## 4. Readiness check

Открыть:

`https://krug-crm.vercel.app/api/health`

Перед публичным запуском ожидается:

- `supabaseServerSecret: true`
- `telegramBotToken: true`
- `telegramAuthRequired: true`
- `miniAppBookings: "live"`
- loyalty — `live`

## 5. Telegram smoke test

Проверить именно из Telegram, а не только обычного браузера:

- Mini App открывается из кнопки **Open App / Launch App**.
- Telegram user id и username подхватываются автоматически.
- Первый пользователь сохраняет имя + телефон и появляется в CRM Mini App control.
- Каталог услуг и цены загружаются.
- Доступность совпадает с Supabase/CRM.
- Реальная заявка появляется в CRM.
- Та же дата/время после заявки больше не предлагается.
- CRM может подтвердить заявку.
- Клиент видит новый статус после повторного открытия/синхронизации.
- Отмена до начала освобождает слот и возвращает резерв баллов.
- Клиент не может отменить после начала.
- Banned Telegram user id не может создать новую заявку.
- Ручное начисление/списание баллов видно клиенту.
- При использовании баллов они сначала переходят в резерв.
- После фактической оплаты на студии сотрудник закрывает запись в CRM; резерв списывается, новые баллы начисляются по текущему проценту от фактически полученной денежной суммы.
- Повторное закрытие той же записи не создаёт повторных loyalty-транзакций.

## 6. Launch

После smoke test использовать Main Mini App как основную точку входа. Для шаринга можно использовать deep link формата `https://t.me/<bot_username>?startapp`.

GitHub Pages / старую отдельную Mini App не удалять сразу: оставить как резерв на период тестового запуска, но не давать её клиентам как основную ссылку.
