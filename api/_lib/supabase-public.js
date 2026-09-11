'use strict';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dkhhoiunrhskmujlexla.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_HklMtvOEXj1boKbxMqEIrQ_IX1Rf6dB';

async function supabasePublic(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const body = await response.text();
  let data = null;
  try { data = body ? JSON.parse(body) : null; } catch { data = body; }

  if (!response.ok) {
    const error = new Error(data?.message || `Supabase request failed (${response.status})`);
    error.status = response.status;
    error.details = data;
    throw error;
  }

  return data;
}

module.exports = { supabasePublic };
