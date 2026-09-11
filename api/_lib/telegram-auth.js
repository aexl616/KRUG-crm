'use strict';

const crypto = require('crypto');

function safeEqualHex(a, b) {
  try {
    const left = Buffer.from(String(a || ''), 'hex');
    const right = Buffer.from(String(b || ''), 'hex');
    return left.length === right.length && left.length > 0 && crypto.timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

function buildCheckString(params, excludeSignature) {
  return [...params.entries()]
    .filter(([key]) => key !== 'hash' && (!excludeSignature || key !== 'signature'))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
}

function verifyInitData(raw, botToken, { maxAgeSeconds = 86400 } = {}) {
  if (!raw || !botToken) throw Object.assign(new Error('TELEGRAM_AUTH_UNAVAILABLE'), { code: 'TELEGRAM_AUTH_UNAVAILABLE' });
  const params = new URLSearchParams(String(raw));
  const receivedHash = params.get('hash');
  if (!receivedHash || !/^[0-9a-f]{64}$/i.test(receivedHash)) throw Object.assign(new Error('TELEGRAM_AUTH_INVALID'), { code: 'TELEGRAM_AUTH_INVALID' });

  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const candidates = [buildCheckString(params, false)];
  if (params.has('signature')) candidates.push(buildCheckString(params, true));
  const valid = candidates.some(dataCheckString => {
    const expected = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
    return safeEqualHex(expected, receivedHash);
  });
  if (!valid) throw Object.assign(new Error('TELEGRAM_AUTH_INVALID'), { code: 'TELEGRAM_AUTH_INVALID' });

  const authDate = Number(params.get('auth_date'));
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(authDate) || authDate <= 0 || authDate > nowSeconds + 60 || nowSeconds - authDate > maxAgeSeconds) {
    throw Object.assign(new Error('TELEGRAM_AUTH_EXPIRED'), { code: 'TELEGRAM_AUTH_EXPIRED' });
  }

  let user = null;
  try { user = JSON.parse(params.get('user') || 'null'); } catch {}
  if (!user || !Number.isSafeInteger(Number(user.id)) || Number(user.id) <= 0) {
    throw Object.assign(new Error('TELEGRAM_USER_MISSING'), { code: 'TELEGRAM_USER_MISSING' });
  }
  return { ...user, id: Number(user.id), authDate };
}

function resolveTelegramUser(req, claimedUserId = null) {
  const required = process.env.TELEGRAM_AUTH_REQUIRED === '1';
  const botToken = process.env.TELEGRAM_BOT_TOKEN || '';
  const raw = String(req.headers['x-telegram-init-data'] || '');
  let verified = null;

  if (raw && botToken) verified = verifyInitData(raw, botToken);
  else if (required) {
    const code = botToken ? 'TELEGRAM_AUTH_REQUIRED' : 'TELEGRAM_AUTH_UNAVAILABLE';
    throw Object.assign(new Error(code), { code });
  }

  if (verified && claimedUserId != null && Number(claimedUserId) !== verified.id) {
    throw Object.assign(new Error('TELEGRAM_ID_MISMATCH'), { code: 'TELEGRAM_ID_MISMATCH' });
  }
  return verified || (claimedUserId != null ? { id: Number(claimedUserId), unverified: true } : null);
}

function mapTelegramAuthError(error) {
  const code = error?.code || error?.message;
  if (code === 'TELEGRAM_AUTH_REQUIRED') return [401, 'TELEGRAM_AUTH_REQUIRED', 'Открой Mini App через Telegram и попробуй ещё раз.'];
  if (code === 'TELEGRAM_AUTH_INVALID') return [401, 'TELEGRAM_AUTH_INVALID', 'Не удалось подтвердить Telegram-сессию. Закрой и заново открой Mini App.'];
  if (code === 'TELEGRAM_AUTH_EXPIRED') return [401, 'TELEGRAM_AUTH_EXPIRED', 'Telegram-сессия устарела. Закрой и заново открой Mini App.'];
  if (code === 'TELEGRAM_USER_MISSING') return [401, 'TELEGRAM_USER_MISSING', 'Telegram не передал профиль пользователя.'];
  if (code === 'TELEGRAM_ID_MISMATCH') return [403, 'TELEGRAM_ID_MISMATCH', 'Telegram-профиль не совпадает с запросом.'];
  if (code === 'TELEGRAM_AUTH_UNAVAILABLE') return [503, 'TELEGRAM_AUTH_UNAVAILABLE', 'Авторизация Telegram ещё не настроена на сервере.'];
  return null;
}

module.exports = { verifyInitData, resolveTelegramUser, mapTelegramAuthError };
