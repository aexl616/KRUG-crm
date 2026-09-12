'use strict';

const { supabaseServer } = require('./_lib/supabase-server');
const { readJsonBody, apiError } = require('./_lib/http');

function adminToken(req) {
  const value = String(req.headers.authorization || '');
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function mapError(error) {
  const message = String(error?.message || error?.details?.message || '');
  if (message.includes('SUPABASE_SERVER_SECRET_REQUIRED')) return [503, 'SERVER_SECRET_REQUIRED', 'Серверный доступ к базе ещё не настроен.'];
  if (message.includes('ADMIN_UNAUTHORIZED')) return [401, 'ADMIN_UNAUTHORIZED', 'Неверный ключ синхронизации CRM.'];
  if (message.includes('INVALID_CRM_STATE')) return [400, 'INVALID_CRM_STATE', 'Состояние CRM повреждено.'];
  if (message.includes('CRM_STATE_TOO_LARGE')) return [413, 'CRM_STATE_TOO_LARGE', 'Объём данных CRM слишком большой для синхронизации.'];
  if (message.includes('CRM_STATE_CONFLICT')) {
    const version = Number(message.split(':').pop());
    return [409, 'CRM_STATE_CONFLICT', 'Данные CRM изменились на другом устройстве.', Number.isFinite(version) ? { currentVersion: version } : undefined];
  }
  return [502, 'CRM_STATE_UNAVAILABLE', 'Облачная синхронизация CRM временно недоступна.'];
}

async function rpc(name, payload) {
  return supabaseServer(`rpc/${name}`, { method: 'POST', body: JSON.stringify(payload) });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return apiError(res, 405, 'METHOD_NOT_ALLOWED');
  }
  const token = adminToken(req);
  if (!token) return apiError(res, 401, 'ADMIN_TOKEN_REQUIRED', 'Нужен ключ синхронизации CRM.');
  const body = readJsonBody(req);
  if (!body) return apiError(res, 400, 'INVALID_JSON');
  const action = String(body.action || 'get');

  try {
    let data;
    if (action === 'get') {
      data = await rpc('krug_crm_state_get', { p_token: token });
    } else if (action === 'put') {
      const expectedVersion = Number(body.expectedVersion);
      if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) return apiError(res, 400, 'INVALID_VERSION');
      const state = body.state && typeof body.state === 'object' && !Array.isArray(body.state) ? body.state : null;
      if (!state) return apiError(res, 400, 'INVALID_CRM_STATE');
      data = await rpc('krug_crm_state_put', {
        p_token: token,
        p_expected_version: expectedVersion,
        p_data: state,
        p_updated_by: String(body.updatedBy || 'crm').slice(0, 120)
      });
    } else {
      return apiError(res, 400, 'UNKNOWN_ACTION');
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    const mapped = mapError(error);
    console.error('[KRUG API] crm state failed', action, mapped[1], error.status || error.name || 'Error');
    const [status, code, message, extra] = mapped;
    return apiError(res, status, code, message, extra);
  }
};
