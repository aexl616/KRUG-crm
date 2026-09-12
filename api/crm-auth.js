'use strict';

const crypto = require('node:crypto');
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

async function table(path, method, body) {
  return supabaseServer(path, {
    method,
    headers: { Prefer: 'return=representation' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
}

function mapError(error) {
  const message = String(error?.message || error?.details?.message || '');
  if (message.includes('SUPABASE_SERVER_SECRET_REQUIRED')) return [503, 'SERVER_SECRET_REQUIRED', 'Серверная авторизация CRM ещё не настроена.'];
  if (message.includes('ADMIN_UNAUTHORIZED')) return [401, 'BOOTSTRAP_UNAUTHORIZED', 'Неверный ключ управления Mini App.'];
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

async function bootstrapOwner(adminToken) {
  // Reuse the already deployed, server-side Mini App admin authority. The key
  // is never persisted by this endpoint and never becomes a CRM session token.
  await rpc('krug_admin_app_overview', { p_token: adminToken });
  let activated = false;
  try {
    const userRows = await table('crm_staff_users?user_id=eq.u1', 'PATCH', {
      active: true,
      name: 'AE XL',
      role: 'owner',
      must_change_password: true,
      updated_at: new Date().toISOString()
    });
    const user = Array.isArray(userRows) ? userRows[0] : null;
    if (!user) throw new Error('CRM_STAFF_NOT_FOUND');
    activated = true;

    await table('crm_staff_sessions?user_id=eq.u1', 'DELETE');
    const sessionRows = await table('crm_staff_sessions', 'POST', { user_id: 'u1' });
    const session = Array.isArray(sessionRows) ? sessionRows[0] : null;
    if (!session?.token) throw new Error('CRM_SESSION_INVALID');

    // Replace the old public demo password immediately with an unknowable server
    // secret, then mark rotation required so the UI asks the owner for a new one.
    const randomPassword = crypto.randomBytes(36).toString('base64url');
    await rpc('krug_crm_change_password', { p_token: session.token, p_password: randomPassword });
    await table('crm_staff_users?user_id=eq.u1', 'PATCH', { must_change_password: true, updated_at: new Date().toISOString() });

    return {
      token: session.token,
      expiresAt: session.expires_at,
      user: { id: 'u1', name: 'AE XL', login: user.login || 'admin', role: 'owner', mustChangePassword: true }
    };
  } catch (error) {
    if (activated) {
      await table('crm_staff_users?user_id=eq.u1', 'PATCH', { active: false, updated_at: new Date().toISOString() }).catch(() => {});
      await table('crm_staff_sessions?user_id=eq.u1', 'DELETE').catch(() => {});
    }
    throw error;
  }
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
    } else if (action === 'bootstrapOwner') {
      const adminToken = String(body.adminToken || '').trim();
      if (adminToken.length < 12 || adminToken.length > 500) return apiError(res, 400, 'INVALID_BOOTSTRAP_TOKEN');
      data = await bootstrapOwner(adminToken);
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
