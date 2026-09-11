'use strict';

const { supabaseServer } = require('../_lib/supabase-server');
const { applyPublicCors, readJsonBody, apiError } = require('../_lib/http');
const { resolveTelegramUser, mapTelegramAuthError } = require('../_lib/telegram-auth');

function mapError(error) {
  const auth = mapTelegramAuthError(error);
  if (auth) return auth;
  const message = String(error?.message || error?.details?.message || '');
  if (message.includes('SUPABASE_SERVER_SECRET_REQUIRED')) return [503, 'SERVER_SECRET_REQUIRED', 'Серверный доступ к базе ещё не настроен.'];
  if (message.includes('INVALID_TELEGRAM_USER_ID')) return [400, 'INVALID_TELEGRAM_USER_ID', 'Не удалось определить Telegram-пользователя.'];
  if (message.includes('INVALID_CLIENT_NAME')) return [400, 'INVALID_CLIENT_NAME', 'Проверь имя.'];
  if (message.includes('INVALID_CLIENT_PHONE')) return [400, 'INVALID_CLIENT_PHONE', 'Проверь номер телефона.'];
  if (message.includes('INVALID_CLIENT_TELEGRAM')) return [400, 'INVALID_CLIENT_TELEGRAM', 'Проверь имя в Telegram.'];
  return [502, 'REGISTRATION_UNAVAILABLE', 'Не удалось сохранить профиль. Попробуй ещё раз.'];
}

module.exports = async function handler(req, res) {
  if (applyPublicCors(req, res)) return;
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return apiError(res, 405, 'METHOD_NOT_ALLOWED');
  }

  const body = readJsonBody(req);
  if (!body) return apiError(res, 400, 'INVALID_JSON');

  const claimedTelegramUserId = Number(body.telegramUserId);
  const name = String(body.name || '').trim();
  const phone = String(body.phone || '').trim();
  const telegram = String(body.telegram || '').trim();

  if (!Number.isSafeInteger(claimedTelegramUserId) || claimedTelegramUserId <= 0) return apiError(res, 400, 'INVALID_TELEGRAM_USER_ID');
  if (name.length < 2 || name.length > 80) return apiError(res, 400, 'INVALID_CLIENT_NAME');

  try {
    const authUser = resolveTelegramUser(req, claimedTelegramUserId);
    const telegramUserId = authUser?.id || claimedTelegramUserId;
    const client = await supabaseServer('rpc/krug_register_app_client', {
      method: 'POST',
      body: JSON.stringify({
        p_telegram_user_id: telegramUserId,
        p_name: name,
        p_phone: phone,
        p_telegram_username: telegram || null
      })
    });

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, client });
  } catch (error) {
    const [status, code, message] = mapError(error);
    console.error('[KRUG API] app registration failed', code, error.status || error.name || 'Error');
    return apiError(res, status, code, message);
  }
};
