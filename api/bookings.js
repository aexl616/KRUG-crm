'use strict';

const { supabasePublic } = require('./_lib/supabase-public');
const { applyPublicCors, readJsonBody, apiError } = require('./_lib/http');
const { resolveTelegramUser, mapTelegramAuthError } = require('./_lib/telegram-auth');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function mapBookingError(error) {
  const auth = mapTelegramAuthError(error);
  if (auth) return auth;
  const message = String(error?.message || error?.details?.message || '');
  if (message.includes('USER_BANNED')) return [403, 'USER_BANNED', 'Доступ к записи через Mini App ограничен. Свяжись со студией.'];
  if (message.includes('SLOT_UNAVAILABLE')) return [409, 'SLOT_UNAVAILABLE', 'Это время уже заняли. Выбери другое.'];
  if (message.includes('SERVICE_UNAVAILABLE')) return [400, 'SERVICE_UNAVAILABLE', 'Эта услуга сейчас недоступна.'];
  if (message.includes('DURATION_UNAVAILABLE')) return [400, 'DURATION_UNAVAILABLE', 'Эта длительность недоступна для услуги.'];
  if (message.includes('BOOKING_TOO_FAR')) return [400, 'BOOKING_TOO_FAR', 'Пока можно записаться только на ближайшие 3 недели.'];
  if (message.includes('BOOKING_IN_PAST')) return [400, 'BOOKING_IN_PAST', 'Нельзя создать запись в прошлом.'];
  if (message.includes('INVALID_CLIENT_NAME')) return [400, 'INVALID_CLIENT_NAME', 'Проверь имя.'];
  if (message.includes('INVALID_CLIENT_PHONE')) return [400, 'INVALID_CLIENT_PHONE', 'Проверь номер телефона.'];
  if (message.includes('INVALID_CLIENT_TELEGRAM')) return [400, 'INVALID_CLIENT_TELEGRAM', 'Проверь имя в Telegram.'];
  if (message.includes('COMMENT_TOO_LONG')) return [400, 'COMMENT_TOO_LONG', 'Комментарий слишком длинный.'];
  if (message.includes('INVALID_REQUEST_ID')) return [400, 'INVALID_REQUEST_ID', 'Не удалось идентифицировать заявку.'];
  return [502, 'BOOKING_UNAVAILABLE', 'Не удалось создать запись. Попробуй ещё раз.'];
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
  const serviceId = String(body.serviceId || '');
  const date = String(body.date || '');
  const startTime = String(body.startTime || '');
  const durationHours = Number(body.durationHours);
  const client = body.client && typeof body.client === 'object' ? body.client : {};
  const name = String(client.name || '').trim();
  const phone = String(client.phone || '').trim();
  const telegram = String(client.telegram || '').trim();
  const telegramUserIdRaw = client.telegramUserId ?? body.telegramUserId ?? null;
  const claimedTelegramUserId = telegramUserIdRaw == null || telegramUserIdRaw === '' ? null : Number(telegramUserIdRaw);
  const comment = String(body.comment || '').trim();
  const useBonuses = body.useBonuses === true;

  if (!UUID_RE.test(requestId)) return apiError(res, 400, 'INVALID_REQUEST_ID');
  if (!serviceId || serviceId.length > 80) return apiError(res, 400, 'INVALID_SERVICE');
  if (!DATE_RE.test(date)) return apiError(res, 400, 'INVALID_DATE');
  if (!TIME_RE.test(startTime)) return apiError(res, 400, 'INVALID_TIME');
  if (!Number.isFinite(durationHours) || durationHours <= 0 || durationHours > 12) return apiError(res, 400, 'INVALID_DURATION');
  if (name.length < 2 || name.length > 80) return apiError(res, 400, 'INVALID_CLIENT_NAME');
  if (comment.length > 1000) return apiError(res, 400, 'COMMENT_TOO_LONG');
  if (claimedTelegramUserId != null && (!Number.isSafeInteger(claimedTelegramUserId) || claimedTelegramUserId <= 0)) return apiError(res, 400, 'INVALID_TELEGRAM_USER_ID');
  if (useBonuses && claimedTelegramUserId == null) return apiError(res, 400, 'LOYALTY_REQUIRES_TELEGRAM', 'Баллы доступны после входа через Telegram.');

  try {
    const authUser = resolveTelegramUser(req, claimedTelegramUserId);
    const telegramUserId = authUser?.id || claimedTelegramUserId;
    const booking = await supabasePublic('rpc/krug_create_booking_v3', {
      method: 'POST',
      body: JSON.stringify({
        p_request_id: requestId,
        p_service_id: serviceId,
        p_date: date,
        p_start_time: startTime,
        p_duration_hours: durationHours,
        p_client_name: name,
        p_client_phone: phone,
        p_client_telegram: telegram || null,
        p_telegram_user_id: telegramUserId,
        p_comment: comment,
        p_use_bonuses: useBonuses
      })
    });
    return res.status(201).json({ ok: true, booking });
  } catch (error) {
    const [status, code, message] = mapBookingError(error);
    console.error('[KRUG API] booking failed', code, error.status || error.name || 'Error');
    return apiError(res, status, code, message);
  }
};
