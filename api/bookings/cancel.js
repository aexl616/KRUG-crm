'use strict';

const { supabaseServer } = require('../_lib/supabase-server');
const { applyPublicCors, readJsonBody, apiError } = require('../_lib/http');
const { resolveTelegramUser, mapTelegramAuthError } = require('../_lib/telegram-auth');
const { processDueNotifications } = require('../_lib/telegram');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function mapCancelError(error) {
  const auth = mapTelegramAuthError(error);
  if (auth) return auth;
  const message = String(error?.message || error?.details?.message || '');
  if (message.includes('SUPABASE_SERVER_SECRET_REQUIRED')) return [503, 'SERVER_SECRET_REQUIRED', 'Серверный доступ к базе ещё не настроен.'];
  if (message.includes('BOOKING_NOT_FOUND')) return [404, 'BOOKING_NOT_FOUND', 'Запись не найдена.'];
  if (message.includes('CANCELLATION_AFTER_START')) return [409, 'CANCELLATION_AFTER_START', 'После начала сессии отменить запись в приложении нельзя. Свяжись со студией.'];
  if (message.includes('CANCELLATION_NOT_ALLOWED')) return [409, 'CANCELLATION_NOT_ALLOWED', 'Эту запись уже нельзя отменить.'];
  if (message.includes('INVALID_REQUEST_ID')) return [400, 'INVALID_REQUEST_ID', 'Не удалось идентифицировать заявку.'];
  return [502, 'CANCELLATION_UNAVAILABLE', 'Не удалось отменить запись. Попробуй ещё раз.'];
}

module.exports = async function handler(req, res) {
  if (applyPublicCors(req, res)) return;
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return apiError(res, 405, 'METHOD_NOT_ALLOWED');
  }

  const body = readJsonBody(req);
  if (!body) return apiError(res, 400, 'INVALID_JSON');
  const requestId = String(body.requestId || '');
  if (!UUID_RE.test(requestId)) return apiError(res, 400, 'INVALID_REQUEST_ID');

  try {
    resolveTelegramUser(req);
    const booking = await supabaseServer('rpc/krug_cancel_booking', {
      method: 'POST',
      body: JSON.stringify({ p_request_id: requestId })
    });
    processDueNotifications(10).catch(error => console.warn('[KRUG API] telegram cancellation notice delayed', error.message || error));
    return res.status(200).json({ ok: true, booking });
  } catch (error) {
    const [status, code, message] = mapCancelError(error);
    console.error('[KRUG API] cancellation failed', code, error.status || error.name || 'Error');
    return apiError(res, status, code, message);
  }
};
