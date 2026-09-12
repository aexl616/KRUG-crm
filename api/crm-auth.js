'use strict';

const { supabaseServer } = require('./_lib/supabase-server');
const { readJsonBody, apiError } = require('./_lib/http');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROLES = new Set(['owner','admin','engineer','staff']);

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
  if (message.includes('CRM_PASSWORD_WEAK')) return [400, 'CRM_PASSWORD_WEAK', 'Пароль должен быть не короче 10 символов.'];
  if (message.includes('CRM_LOGIN_EXISTS')) return [409, 'CRM_LOGIN_EXISTS', 'Такой логин уже есть.'];
  if (message.includes('CRM_ROLE_INVALID')) return [400, 'CRM_ROLE_INVALID', 'Некорректная роль сотрудника.'];
  if (message.includes('CRM_STAFF_INVALID')) return [400, 'CRM_STAFF_INVALID', 'Проверь имя и логин сотрудника.'];
  if (message.includes('CRM_STAFF_NOT_FOUND')) return [404, 'CRM_STAFF_NOT_FOUND', 'Сотрудник не найден.'];
  if (message.includes('CRM_LAST_OWNER')) return [409, 'CRM_LAST_OWNER', 'Нельзя убрать единственного активного владельца.'];
  if (message.includes('CRM_SELF_DEACTIVATE')) return [409, 'CRM_SELF_DEACTIVATE', 'Нельзя отключить собственный аккаунт.'];
  if (message.includes('CRM_SELF_DELETE')) return [409, 'CRM_SELF_DELETE', 'Нельзя удалить собственный аккаунт.'];
  if (message.includes('CRM_OWNER_DELETE')) return [409, 'CRM_OWNER_DELETE', 'Владельца нельзя удалить.'];
  if (message.includes('CRM_FORBIDDEN')) return [403, 'CRM_FORBIDDEN', 'Недостаточно прав.'];
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
    } else {
      const token = bearer(req);
      if (!UUID_RE.test(token)) return apiError(res, 401, 'CRM_SESSION_REQUIRED', 'Войди в CRM.');
      if (action === 'session') {
        data = await rpc('krug_crm_session_get', { p_token: token });
      } else if (action === 'logout') {
        data = await rpc('krug_crm_logout', { p_token: token });
      } else if (action === 'changePassword') {
        const password = String(body.password || '');
        if (password.length < 10 || password.length > 200) return apiError(res, 400, 'CRM_PASSWORD_WEAK', 'Пароль должен быть не короче 10 символов.');
        data = await rpc('krug_crm_change_password', { p_token: token, p_password: password });
      } else if (action === 'staffList') {
        data = await rpc('krug_crm_staff_list', { p_token: token });
      } else if (action === 'staffCreate') {
        const login = String(body.login || '').trim();
        const password = String(body.password || '');
        const name = String(body.name || '').trim();
        const role = String(body.role || 'staff').trim().toLowerCase();
        if (login.length < 3 || login.length > 120 || name.length < 2 || name.length > 120) return apiError(res, 400, 'CRM_STAFF_INVALID', 'Проверь имя и логин сотрудника.');
        if (password.length < 10 || password.length > 200) return apiError(res, 400, 'CRM_PASSWORD_WEAK', 'Временный пароль должен быть не короче 10 символов.');
        if (!ROLES.has(role)) return apiError(res, 400, 'CRM_ROLE_INVALID');
        data = await rpc('krug_crm_staff_create', { p_token: token, p_login: login, p_password: password, p_name: name, p_role: role });
      } else if (action === 'staffUpdate') {
        const userId = String(body.userId || '');
        const name = String(body.name || '').trim();
        const role = String(body.role || '').trim().toLowerCase();
        const active = body.active === true;
        if (!userId || userId.length > 120 || name.length < 2 || name.length > 120) return apiError(res, 400, 'CRM_STAFF_INVALID');
        if (!ROLES.has(role)) return apiError(res, 400, 'CRM_ROLE_INVALID');
        data = await rpc('krug_crm_staff_update', { p_token: token, p_user_id: userId, p_name: name, p_role: role, p_active: active });
      } else if (action === 'staffDelete') {
        const userId = String(body.userId || '');
        if (!userId || userId.length > 120) return apiError(res, 400, 'CRM_STAFF_INVALID');
        data = await rpc('krug_crm_staff_delete', { p_token: token, p_user_id: userId });
      } else {
        return apiError(res, 400, 'UNKNOWN_ACTION');
      }
    }
    res.setHeader('Cache-Control', 'no-store, private');
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    const [status, code, message] = mapError(error);
    console.error('[KRUG API] crm auth failed', action, code, error.status || error.name || 'Error');
    return apiError(res, status, code, message);
  }
};
