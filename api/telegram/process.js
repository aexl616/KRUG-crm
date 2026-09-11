'use strict';

const { supabaseServer } = require('../_lib/supabase-server');
const { processDueNotifications } = require('../_lib/telegram');
const { apiError } = require('../_lib/http');

function token(req) {
  const value = String(req.headers.authorization || '');
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

module.exports = async function handler(req, res) {
  if (!['POST','GET'].includes(req.method)) {
    res.setHeader('Allow','GET, POST');
    return apiError(res,405,'METHOD_NOT_ALLOWED');
  }
  const admin = token(req);
  if (!admin) return apiError(res,401,'ADMIN_TOKEN_REQUIRED','Нужен ключ управления Mini App.');
  try {
    await supabaseServer('rpc/krug_admin_notifications_overview', {
      method:'POST', body:JSON.stringify({ p_token:admin })
    });
    const stats = await processDueNotifications(50);
    res.setHeader('Cache-Control','no-store');
    return res.status(200).json({ ok:true, stats });
  } catch (error) {
    const message = String(error?.message || '');
    if (message.includes('ADMIN_UNAUTHORIZED')) return apiError(res,401,'ADMIN_UNAUTHORIZED','Неверный ключ управления Mini App.');
    if (message.includes('TELEGRAM_BOT_TOKEN_REQUIRED')) return apiError(res,503,'TELEGRAM_BOT_TOKEN_REQUIRED');
    console.error('[KRUG API] telegram process failed', error.status || error.name || 'Error');
    return apiError(res,502,'TELEGRAM_PROCESS_FAILED','Не удалось обработать очередь Telegram.');
  }
};
