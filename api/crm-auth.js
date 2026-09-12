'use strict';

const { supabaseServer } = require('./_lib/supabase-server');
const { readJsonBody, apiError } = require('./_lib/http');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function bearer(req) {
  const value = String(req.headers.authorization || '');
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

async function rpc(name, payload) {
  return supabaseServer(`rpc/${name}`, { method: 'POST', body: JSON.stringify(payload) });
}

function mapError(error) {
  const message = String(error?.message || error?.details?.message || '');
  if (message.includes('SUPABASE_SERVER_SECRET_REQUIRED')) return [503, 'SERVER_SECRET_REQUIRED', 'Серверная авторизация CRM ещё не настроена.'];
  if (message.includes('CRM_AUTH_INVALID')) return [401, 'CRM_AUTH_INVALID', 'Неверный логин или пароль.'];
  if (message.includes('CRM_SESSION_INVALID')) return [401, 'CRM_SESSION_INVALID', 'Сессия истекла. Войди снова.'];
  if (message.includes('CRM_PASSWORD_WEAK')) return [400, 'CRM_PASSWORD_WEAK', 'Новый пароль должен быть не короче 10 символов.'];
  return [502, 'CRM_AUTH_UNAVAILABLE', 'Авторизация CRM временно недоступна.'];
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return apiError(res, 405, 'METHOD_NOT_ALLOWED');
  }
  const body = readJsonBody(req);
  if (!body) return apiError(res, 400, 'INVALID_JSON');
  const action = String(body.action || 'session');

  try {
    let data;
    if (action === 'login') {
      const login = String(body.login || '').trim();
      const password = String(body.password || '');
      if (!login || !password || login.length > 120 || password.length > 300) return apiError(res, 400, 'INVALID_CREDENTIALS');
      data = await rpc('krug_crm_login', { p_login: login, p_password: password });
    } else if (action === 'session' || action === 'logout' || action === 'changePassword') {
      const token = bearer(req);
      if (!UUID_RE.test(token)) return apiError(res, 401, 'CRM_SESSION_REQUIRED', 'Войди в CRM.');
      if (action === 'session') data = await rpc('krug_crm_session_get', { p_token: token });
      else if (action === 'logout') data = await rpc('krug_crm_logout', { p_token: token });
      else {
        const password = String(body.password || '');
        if (password.length < 10 || password.length > 200) return apiError(res, 400, 'CRM_PASSWORD_WEAK', 'Новый пароль должен быть не короче 10 символов.');
        data = await rpc('krug_crm_change_password', { p_token: token, p_password: password });
      }
    } else {
      return apiError(res, 400, 'UNKNOWN_ACTION');
    }
    res.setHeader('Cache-Control', 'no-store, private');
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    const [status, code, message] = mapError(error);
    console.error('[KRUG API] crm auth failed', action, code, error.status || error.name || 'Error');
    return apiError(res, status, code, message);
  }
};
