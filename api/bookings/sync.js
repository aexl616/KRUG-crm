'use strict';

const { supabaseServer } = require('../_lib/supabase-server');
const { applyPublicCors, readJsonBody, apiError } = require('../_lib/http');
const { resolveTelegramUser, mapTelegramAuthError } = require('../_lib/telegram-auth');

module.exports = async function handler(req, res) {
  if (applyPublicCors(req, res)) return;
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return apiError(res, 405, 'METHOD_NOT_ALLOWED');
  }

  const body = readJsonBody(req);
  if (!body) return apiError(res, 400, 'INVALID_JSON');

  try {
    const telegramUser = resolveTelegramUser(req);
    const telegramUserId = Number(telegramUser?.id);
    if (!Number.isSafeInteger(telegramUserId) || telegramUserId <= 0) {
      return apiError(res, 401, 'TELEGRAM_AUTH_REQUIRED', 'Открой Mini App через Telegram и попробуй ещё раз.');
    }

    const bookings = await supabaseServer('rpc/krug_list_bookings_for_telegram', {
      method: 'POST',
      body: JSON.stringify({ p_telegram_user_id: telegramUserId })
    });

    return res.status(200).json({ ok: true, bookings: Array.isArray(bookings) ? bookings : [] });
  } catch (error) {
    const auth = mapTelegramAuthError(error);
    if (auth) return apiError(res, auth[0], auth[1], auth[2]);
    if (String(error?.message || '').includes('SUPABASE_SERVER_SECRET_REQUIRED')) return apiError(res, 503, 'SERVER_SECRET_REQUIRED', 'Серверный доступ к базе ещё не настроен.');
    console.error('[KRUG API] booking sync failed', error.status || error.name || 'Error');
    return apiError(res, 502, 'BOOKING_SYNC_UNAVAILABLE');
  }
};
