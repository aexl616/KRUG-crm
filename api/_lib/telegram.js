'use strict';

const { supabaseServer } = require('./supabase-server');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const API = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}` : '';

function ensureBot() {
  if (!BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN_REQUIRED');
}

async function sendMessage(row) {
  ensureBot();
  const replyMarkup = row.button_text && row.button_url ? {
    inline_keyboard: [[{ text: row.button_text, web_app: { url: row.button_url } }]]
  } : undefined;
  const response = await fetch(`${API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: row.telegram_user_id,
      text: row.text,
      disable_web_page_preview: true,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {})
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    const error = new Error(data?.description || `Telegram send failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return data.result;
}

async function processDueNotifications(limit = 25) {
  ensureBot();
  const now = encodeURIComponent(new Date().toISOString());
  const rows = await supabaseServer(`telegram_notifications?select=id,telegram_user_id,text,button_text,button_url,campaign_id,attempts&status=eq.pending&scheduled_at=lte.${now}&order=scheduled_at.asc&limit=${Math.max(1,Math.min(100,Number(limit)||25))}`);
  const stats = { picked: Array.isArray(rows) ? rows.length : 0, sent: 0, failed: 0 };
  for (const row of rows || []) {
    try {
      await supabaseServer(`telegram_notifications?id=eq.${row.id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status:'processing', attempts:Number(row.attempts||0)+1, last_error:null })
      });
      await sendMessage(row);
      await supabaseServer(`telegram_notifications?id=eq.${row.id}`, {
        method: 'PATCH', headers:{ Prefer:'return=minimal' }, body:JSON.stringify({ status:'sent', sent_at:new Date().toISOString() })
      });
      if (row.campaign_id) await supabaseServer(`telegram_campaigns?id=eq.${row.campaign_id}`, {
        method:'PATCH', headers:{ Prefer:'return=minimal' }, body:JSON.stringify({})
      }).catch(()=>{});
      stats.sent++;
    } catch (error) {
      const attempts = Number(row.attempts||0)+1;
      const retry = attempts < 4;
      await supabaseServer(`telegram_notifications?id=eq.${row.id}`, {
        method:'PATCH', headers:{ Prefer:'return=minimal' }, body:JSON.stringify({
          status: retry ? 'pending' : 'failed',
          scheduled_at: retry ? new Date(Date.now()+Math.min(30,attempts*5)*60000).toISOString() : undefined,
          last_error:String(error.message||error).slice(0,500)
        })
      }).catch(()=>{});
      stats.failed++;
    }
  }
  return stats;
}

module.exports = { sendMessage, processDueNotifications };
