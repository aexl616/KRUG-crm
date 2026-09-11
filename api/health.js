'use strict';

const { applyPublicCors, apiError } = require('./_lib/http');

module.exports = function handler(req, res) {
  if (applyPublicCors(req, res)) return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return apiError(res, 405, 'METHOD_NOT_ALLOWED');
  }

  return res.status(200).json({
    ok: true,
    service: 'krug-api',
    version: '0.4.6',
    timezone: 'Europe/Moscow',
    payments: 'on_site_only',
    appManagement: true,
    miniAppBookings: 'live',
    loyalty: 'demo_until_0.5'
  });
};
