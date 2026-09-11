'use strict';

module.exports = function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
  }

  return res.status(200).json({
    ok: true,
    service: 'krug-api',
    version: '0.4.0',
    timezone: 'Europe/Moscow'
  });
};
