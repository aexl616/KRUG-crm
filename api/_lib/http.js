'use strict';

function applyPublicCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Telegram-Init-Data');
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

function readJsonBody(req) {
  if (req.body == null) return {};
  if (typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body); }
  catch { return null; }
}

function apiError(res, status, code, message) {
  return res.status(status).json({ ok: false, error: code, ...(message ? { message } : {}) });
}

module.exports = { applyPublicCors, readJsonBody, apiError };
