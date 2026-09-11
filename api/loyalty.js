'use strict';

const { supabasePublic } = require('./_lib/supabase-public');
const { applyPublicCors, readJsonBody, apiError } = require('./_lib/http');

function mapError(error) {
  const message = String(error?.message || error?.details?.message || '');
  if (message.includes('INVALID_TELEGRAM_USER_ID')) return [400, 'INVALID_TELEGRAM_USER_ID', 'Не удалось определить Telegram-профиль.'];
  if (message.includes('CLIENT_NOT_FOUND')) return [404, 'CLIENT_NOT_FOUND', 'Сначала сохрани профиль в Mini App.'];
  return [502, 'LOYALTY_UNAVAILABLE', 'Баллы временно недоступны. Попробуй ещё раз.'];
}

module.exports = async function handler(req, res) {
  if (applyPublicCors(req, res)) return;
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return apiError(res, 405, 'METHOD_NOT_ALLOWED');
  }

  const body = readJsonBody(req);
  if (!body) return apiError(res, 400, 'INVALID_JSON');
  const telegramUserId = Number(body.telegramUserId);
  if (!Number.isSafeInteger(telegramUserId) || telegramUserId <= 0) {
    return apiError(res, 400, 'INVALID_TELEGRAM_USER_ID');
  }

  try {
    const loyalty = await supabasePublic('rpc/krug_loyalty_snapshot', {
      method: 'POST',
      body: JSON.stringify({ p_telegram_user_id: telegramUserId })
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, loyalty });
  } catch (error) {
    const [status, code, message] = mapError(error);
    console.error('[KRUG API] loyalty failed', code, error.status || error.name || 'Error');
    return apiError(res, status, code, message);
  }
};
