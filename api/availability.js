'use strict';

const { supabasePublic } = require('./_lib/supabase-public');
const { applyPublicCors, apiError } = require('./_lib/http');

const MOSCOW_TZ = 'Europe/Moscow';

function moscowToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MOSCOW_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const get = type => parts.find(part => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function addDays(date, days) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

module.exports = async function handler(req, res) {
  if (applyPublicCors(req, res)) return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return apiError(res, 405, 'METHOD_NOT_ALLOWED');
  }

  const date = String(req.query?.date || '');
  const serviceId = String(req.query?.serviceId || '');
  const durationHours = Number(req.query?.durationHours);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return apiError(res, 400, 'INVALID_DATE');
  if (!serviceId || serviceId.length > 80) return apiError(res, 400, 'INVALID_SERVICE');
  if (!Number.isFinite(durationHours) || durationHours <= 0 || durationHours > 12) {
    return apiError(res, 400, 'INVALID_DURATION');
  }

  const today = moscowToday();
  if (date < today || date > addDays(today, 21)) {
    return apiError(res, 400, 'DATE_OUT_OF_RANGE');
  }

  try {
    const data = await supabasePublic('rpc/krug_available_slots', {
      method: 'POST',
      body: JSON.stringify({
        p_date: date,
        p_duration_hours: durationHours,
        p_service_id: serviceId
      })
    });

    return res.status(200).json({ ok: true, availability: data });
  } catch (error) {
    console.error('[KRUG API] availability failed', error.status || error.name || 'Error');
    return apiError(res, 502, 'AVAILABILITY_UNAVAILABLE');
  }
};
