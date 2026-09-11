'use strict';

const { supabaseServer } = require('../_lib/supabase-server');
const { readJsonBody, apiError } = require('../_lib/http');

function token(req) {
  const value = String(req.headers.authorization || '');
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

module.exports = async function handler(req,res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow','POST');
    return apiError(res,405,'METHOD_NOT_ALLOWED');
  }
  const admin = token(req);
  if (!admin) return apiError(res,401,'ADMIN_TOKEN_REQUIRED');
  const body = readJsonBody(req);
  if (!body) return apiError(res,400,'INVALID_JSON');
  const action = String(body.action || 'overview');
  try {
    let data;
    if (action === 'overview') {
      data = await supabaseServer('rpc/krug_admin_notifications_overview', { method:'POST', body:JSON.stringify({ p_token:admin }) });
    } else if (action === 'createCampaign') {
      const message = String(body.message || '').trim();
      const segment = String(body.segment || 'all');
      const buttonText = String(body.buttonText || '').trim();
      const buttonUrl = String(body.buttonUrl || '').trim();
      if (!message || message.length > 3500) return apiError(res,400,'INVALID_CAMPAIGN_MESSAGE','Сообщение должно быть от 1 до 3500 символов.');
      if (!['all','app_registered','app_visited'].includes(segment)) return apiError(res,400,'INVALID_CAMPAIGN_SEGMENT');
      if (buttonUrl && !/^https:\/\//i.test(buttonUrl)) return apiError(res,400,'INVALID_BUTTON_URL','Ссылка должна начинаться с https://');
      data = await supabaseServer('rpc/krug_admin_create_campaign', { method:'POST', body:JSON.stringify({
        p_token:admin,p_message:message,p_segment:segment,p_button_text:buttonText||null,p_button_url:buttonUrl||null
      }) });
    } else {
      return apiError(res,400,'UNKNOWN_ACTION');
    }
    res.setHeader('Cache-Control','no-store');
    return res.status(200).json({ok:true,data});
  } catch(error) {
    const message = String(error?.message || '');
    if (message.includes('ADMIN_UNAUTHORIZED')) return apiError(res,401,'ADMIN_UNAUTHORIZED','Неверный ключ управления Mini App.');
    console.error('[KRUG API] telegram admin failed', action, error.status || error.name || 'Error');
    return apiError(res,502,'TELEGRAM_ADMIN_FAILED','Не удалось выполнить операцию с Telegram.');
  }
};
