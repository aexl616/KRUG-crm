'use strict';

const { applyPublicCors, apiError } = require('./_lib/http');

module.exports = function handler(req, res) {
  if (applyPublicCors(req, res)) return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return apiError(res, 405, 'METHOD_NOT_ALLOWED');
  }

  const hasSupabaseServerSecret = Boolean(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
  const hasTelegramBotToken = Boolean(process.env.TELEGRAM_BOT_TOKEN);
  const telegramAuthRequired = process.env.TELEGRAM_AUTH_REQUIRED === '1';
  const telegramReady = hasSupabaseServerSecret && hasTelegramBotToken && telegramAuthRequired;

  return res.status(200).json({
    ok: true,
    service: 'krug-api',
    version: '0.5.0',
    timezone: 'Europe/Moscow',
    payments: 'on_site_only',
    appManagement: true,
    miniAppBookings: 'live',
    loyalty: 'live',
    telegram: telegramReady ? 'enforced' : 'prepared_waiting_for_env',
    readiness: {
      supabaseServerSecret: hasSupabaseServerSecret,
      telegramBotToken: hasTelegramBotToken,
      telegramAuthRequired,
      launchReady: telegramReady
    }
  });
};
