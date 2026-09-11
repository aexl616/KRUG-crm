'use strict';

const { supabasePublic } = require('./_lib/supabase-public');
const { readJsonBody, apiError } = require('./_lib/http');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function adminToken(req) {
  const value = String(req.headers.authorization || '');
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function mapError(error) {
  const message = String(error?.message || error?.details?.message || '');
  if (message.includes('ADMIN_UNAUTHORIZED')) return [401, 'ADMIN_UNAUTHORIZED', 'Неверный ключ управления Mini App.'];
  if (message.includes('INVALID_PERCENT')) return [400, 'INVALID_PERCENT', 'Процент должен быть от 0 до 100.'];
  if (message.includes('INVALID_POINTS_AMOUNT')) return [400, 'INVALID_POINTS_AMOUNT', 'Некорректное количество баллов.'];
  if (message.includes('INSUFFICIENT_POINTS')) return [409, 'INSUFFICIENT_POINTS', 'Нельзя списать больше баллов, чем есть на балансе.'];
  if (message.includes('INVALID_REASON')) return [400, 'INVALID_REASON', 'Добавь короткую причину операции.'];
  if (message.includes('INVALID_TELEGRAM_USER_ID')) return [400, 'INVALID_TELEGRAM_USER_ID', 'Некорректный Telegram user ID.'];
  if (message.includes('CLIENT_NOT_FOUND')) return [404, 'CLIENT_NOT_FOUND', 'Клиент не найден.'];
  if (message.includes('BOOKING_NOT_FOUND')) return [404, 'BOOKING_NOT_FOUND', 'Запись не найдена.'];
  if (message.includes('BOOKING_CANCELLED')) return [409, 'BOOKING_CANCELLED', 'Отменённую запись нельзя оплатить.'];
  if (message.includes('PAYMENT_BEFORE_START')) return [409, 'PAYMENT_BEFORE_START', 'Оплату можно зафиксировать только после начала сессии.'];
  if (message.includes('INVALID_PAID_AMOUNT')) return [400, 'INVALID_PAID_AMOUNT', 'Проверь фактически полученную сумму.'];
  if (message.includes('INVALID_PAYMENT_METHOD')) return [400, 'INVALID_PAYMENT_METHOD', 'Укажи способ оплаты.'];
  if (message.includes('STATUS_CHANGE_NOT_ALLOWED')) return [409, 'STATUS_CHANGE_NOT_ALLOWED', 'Для этой записи изменение статуса недоступно.'];
  if (message.includes('CANCELLATION_NOT_ALLOWED')) return [409, 'CANCELLATION_NOT_ALLOWED', 'Эту запись уже нельзя отменить.'];
  if (message.includes('MERGE_CANDIDATE_NOT_FOUND')) return [404, 'MERGE_CANDIDATE_NOT_FOUND', 'Предложение объединения уже неактуально.'];
  if (message.includes('MERGE_CLIENT_NOT_FOUND')) return [409, 'MERGE_CLIENT_NOT_FOUND', 'Один из профилей уже изменился. Обнови список.'];
  if (message.includes('INVALID_CLIENTS')) return [400, 'INVALID_CLIENTS', 'Не удалось синхронизировать клиентскую базу.'];
  return [502, 'APP_ADMIN_UNAVAILABLE', 'Управление Mini App временно недоступно.'];
}

async function rpc(name, payload) {
  return supabasePublic(`rpc/${name}`, { method: 'POST', body: JSON.stringify(payload) });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return apiError(res, 405, 'METHOD_NOT_ALLOWED');
  }

  const token = adminToken(req);
  if (!token) return apiError(res, 401, 'ADMIN_TOKEN_REQUIRED', 'Нужен ключ управления Mini App.');

  const body = readJsonBody(req);
  if (!body) return apiError(res, 400, 'INVALID_JSON');
  const action = String(body.action || 'overview');

  try {
    let data;
    if (action === 'overview') {
      data = await rpc('krug_admin_app_overview', { p_token: token });
    } else if (action === 'bookingsOverview') {
      data = await rpc('krug_admin_bookings_overview', { p_token: token });
    } else if (action === 'confirmBooking') {
      const bookingId = String(body.bookingId || '');
      if (!UUID_RE.test(bookingId)) return apiError(res, 400, 'INVALID_BOOKING_ID');
      data = await rpc('krug_admin_confirm_booking', { p_token: token, p_booking_id: bookingId });
    } else if (action === 'settleBooking') {
      const bookingId = String(body.bookingId || '');
      const paidAmount = body.paidAmount == null || body.paidAmount === '' ? null : Number(body.paidAmount);
      const paymentMethod = String(body.paymentMethod || 'На студии').trim();
      if (!UUID_RE.test(bookingId)) return apiError(res, 400, 'INVALID_BOOKING_ID');
      if (paidAmount != null && (!Number.isSafeInteger(paidAmount) || paidAmount < 0)) return apiError(res, 400, 'INVALID_PAID_AMOUNT');
      data = await rpc('krug_admin_settle_booking', {
        p_token: token,
        p_booking_id: bookingId,
        p_paid_amount: paidAmount,
        p_payment_method: paymentMethod
      });
    } else if (action === 'cancelBooking') {
      const bookingId = String(body.bookingId || '');
      if (!UUID_RE.test(bookingId)) return apiError(res, 400, 'INVALID_BOOKING_ID');
      data = await rpc('krug_admin_cancel_booking', { p_token: token, p_booking_id: bookingId });
    } else if (action === 'setPolicy') {
      const percent = Number(body.percent);
      if (!Number.isFinite(percent)) return apiError(res, 400, 'INVALID_PERCENT');
      data = await rpc('krug_admin_set_loyalty_policy', { p_token: token, p_percent: percent });
    } else if (action === 'adjustPoints') {
      const clientId = String(body.clientId || '');
      const amount = Number(body.amount);
      const reason = String(body.reason || '').trim();
      if (!UUID_RE.test(clientId)) return apiError(res, 400, 'INVALID_CLIENT_ID');
      if (!Number.isSafeInteger(amount) || amount === 0) return apiError(res, 400, 'INVALID_POINTS_AMOUNT');
      data = await rpc('krug_admin_adjust_loyalty', { p_token: token, p_client_id: clientId, p_amount: amount, p_reason: reason });
    } else if (action === 'setBan') {
      const telegramUserId = Number(body.telegramUserId);
      const banned = body.banned === true;
      const reason = String(body.reason || '').trim();
      if (!Number.isSafeInteger(telegramUserId) || telegramUserId <= 0) return apiError(res, 400, 'INVALID_TELEGRAM_USER_ID');
      data = await rpc('krug_admin_set_ban', { p_token: token, p_telegram_user_id: telegramUserId, p_banned: banned, p_reason: reason });
    } else if (action === 'importClients') {
      const clients = Array.isArray(body.clients) ? body.clients.slice(0, 1000) : null;
      if (!clients) return apiError(res, 400, 'INVALID_CLIENTS');
      data = await rpc('krug_admin_import_clients', { p_token: token, p_clients: clients });
    } else if (action === 'merge') {
      const candidateId = String(body.candidateId || '');
      if (!UUID_RE.test(candidateId)) return apiError(res, 400, 'INVALID_CANDIDATE_ID');
      data = await rpc('krug_admin_merge_candidate', { p_token: token, p_candidate_id: candidateId });
    } else if (action === 'dismissMerge') {
      const candidateId = String(body.candidateId || '');
      if (!UUID_RE.test(candidateId)) return apiError(res, 400, 'INVALID_CANDIDATE_ID');
      data = await rpc('krug_admin_dismiss_merge', { p_token: token, p_candidate_id: candidateId });
    } else {
      return apiError(res, 400, 'UNKNOWN_ACTION');
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    const [status, code, message] = mapError(error);
    console.error('[KRUG API] app admin failed', action, code, error.status || error.name || 'Error');
    return apiError(res, status, code, message);
  }
};
