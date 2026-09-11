'use strict';

const { supabasePublic } = require('./supabase-public');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dkhhoiunrhskmujlexla.supabase.co';

function serverSecret() {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
}

function hasServerSecret() {
  return Boolean(serverSecret());
}

async function supabaseServer(path, options = {}) {
  const secret = serverSecret();
  if (!secret) {
    if (process.env.TELEGRAM_AUTH_REQUIRED === '1') {
      throw Object.assign(new Error('SUPABASE_SERVER_SECRET_REQUIRED'), { code: 'SUPABASE_SERVER_SECRET_REQUIRED' });
    }
    // Controlled test-mode fallback. Production launch hardening revokes anon RPC
    // execution, so this path naturally stops working once the secret is required.
    return supabasePublic(path, options);
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: secret,
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const body = await response.text();
  let data = null;
  try { data = body ? JSON.parse(body) : null; } catch { data = body; }

  if (!response.ok) {
    const error = new Error(data?.message || `Supabase server request failed (${response.status})`);
    error.status = response.status;
    error.details = data;
    throw error;
  }
  return data;
}

module.exports = { supabaseServer, hasServerSecret };
