'use strict';

const { supabasePublic } = require('../_lib/supabase-public');
const { applyPublicCors, readJsonBody, apiError } = require('../_lib/http');
const { resolveTelegramUser, mapTelegramAuthError } = require('../_lib/telegram-auth');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

module.exports = async function handler(req, res) {
  if (applyPublicCors(req, res)) return;
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return apiError(res, 405, 'METHOD_NOT_ALLOWED');
  }

  const body = readJsonBody(req);
  if (!body) return apiError(res, 400, 'INVALID_JSON');

  const requestIds = Array.isArray(body.requestIds)
    ? [...new Set(body.requestIds.map(value => String(value)).filter(value => UUID_RE.test(value)))].slice(0, 50)
    : [];

  if (!requestIds.length) return res.status(200).json({ ok: true, bookings: [] });

  try {
    // Test mode still permits capability-only sync. Setting TELEGRAM_AUTH_REQUIRED=1
    // makes a valid Telegram Mini App session mandatory without changing the client API.
    resolveTelegramUser(req);
    const bookings = await supabasePublic('rpc/krug_sync_bookings', {
      method: 'POST',
      body: JSON.stringify({ p_request_ids: requestIds })
    });
    return res.status(200).json({ ok: true, bookings: Array.isArray(bookings) ? bookings : [] });
  } catch (error) {
    const auth = mapTelegramAuthError(error);
    if (auth) return apiError(res, auth[0], auth[1], auth[2]);
    console.error('[KRUG API] booking sync failed', error.status || error.name || 'Error');
    return apiError(res, 502, 'BOOKING_SYNC_UNAVAILABLE');
  }
};
