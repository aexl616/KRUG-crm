'use strict';
// Run after deployment, using environment variables supplied by the operator.
// This configures the bot and webhook; it never sends client messages.
const {botCall}=require('../api/_lib/telegram');
async function setupTelegram(){
 const secret=process.env.TELEGRAM_WEBHOOK_SECRET||'';
 const url=new URL(process.env.TELEGRAM_WEBHOOK_URL||'');
 if(!/^[A-Za-z0-9_-]{32,256}$/.test(secret))throw Error('INVALID_WEBHOOK_SECRET');
 if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/api/telegram/process'||url.search!=='?mode=webhook')throw Error('INVALID_WEBHOOK_URL');
 await botCall('getMe');
 await botCall('setWebhook',{url:url.href,secret_token:secret,allowed_updates:['message','my_chat_member'],drop_pending_updates:false});
 await botCall('setMyCommands',{commands:[
  {command:'start',description:'Открыть КРУГ'},{command:'settings',description:'Настройки уведомлений'},
  {command:'marketing_on',description:'Подписаться на новости'},{command:'marketing_off',description:'Отключить новости'},
  {command:'reminders_on',description:'Включить напоминания'},{command:'reminders_off',description:'Отключить напоминания'},
  {command:'30m_on',description:'Напоминать за 30 минут'},{command:'30m_off',description:'Отключить напоминание за 30 минут'}
 ]});
}
module.exports={setupTelegram};
if(require.main===module)setupTelegram().then(()=>console.log('Telegram webhook and commands configured. No client messages sent.')).catch(()=>{console.error('Telegram setup failed. Check environment values and bot connectivity; secrets are omitted.');process.exitCode=1;});
