'use strict';
const crypto=require('node:crypto');
const {supabaseServer,hasServerSecret}=require('./supabase-server');
const content=require('../../telegram-content');
const rpc=(name,payload)=>supabaseServer(`rpc/${name}`,{method:'POST',body:JSON.stringify(payload),signal:AbortSignal.timeout(5000)});
function safeEqual(a,b){const l=Buffer.from(String(a||'')),r=Buffer.from(String(b||''));return l.length>0&&l.length===r.length&&crypto.timingSafeEqual(l,r);}
function requireSecret(){if(!hasServerSecret())throw Error('SUPABASE_SERVER_SECRET_REQUIRED');}
async function staged(stage,fn){try{return await fn();}catch(error){if(!error.stage)error.stage=stage;throw error;}}
async function botCall(method,payload={}){
  const token=process.env.TELEGRAM_BOT_TOKEN;
  if(!token)throw Error('TELEGRAM_BOT_TOKEN_REQUIRED');
  let response,data;
  try{
    response=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(8000)});
    data=await response.json();
  }catch{throw Object.assign(Error('DELIVERY_UNCERTAIN'),{uncertain:true});}
  if(!response.ok||!data.ok){
    const status=Number(data.error_code||response.status);
    throw Object.assign(Error(`TELEGRAM_${status}`),{status,retryAfter:Math.max(1,Math.min(86400,Number(data.parameters?.retry_after)||60)),uncertain:status>=500});
  }
  return data.result;
}
function miniappUrl(){
  const url=new URL(process.env.TELEGRAM_MINI_APP_URL||'https://krug-miniapp.vercel.app');
  if(url.protocol!=='https:'||url.username||url.password)throw Error('TELEGRAM_MINI_APP_URL_INVALID');return url.href;
}
async function sendMessage(row){
  const target=row.button_target||'miniapp';
  const button=target==='miniapp'?{web_app:{url:miniappUrl()}}:{url:row.button_url};
  return botCall('sendMessage',{chat_id:row.telegram_user_id,text:row.text,disable_web_page_preview:true,
    ...(row.button_text&&target!=='none'?{reply_markup:{inline_keyboard:[[{text:row.button_text,...button}]]}}:{})});
}
async function health(){
  const configured=Boolean(process.env.TELEGRAM_BOT_TOKEN);
  if(!configured)return {configured:false,connected:false};
  try{
    const [bot,hook]=await Promise.all([botCall('getMe'),botCall('getWebhookInfo')]);
    return {configured:true,connected:true,username:bot.username,webhook_set:Boolean(hook.url),
      webhook_matches:Boolean(process.env.TELEGRAM_WEBHOOK_URL)&&hook.url===process.env.TELEGRAM_WEBHOOK_URL,
      pending_updates:hook.pending_update_count||0,last_error_at:hook.last_error_date||null};
  }catch{return {configured:true,connected:false};}
}
async function processDueNotifications(limit=10){
  requireSecret();if(!process.env.TELEGRAM_BOT_TOKEN)throw Error('TELEGRAM_BOT_TOKEN_REQUIRED');
  const started=Date.now();
  const templates=await staged('load_templates',()=>supabaseServer('telegram_templates?select=*',{signal:AbortSignal.timeout(5000)}));
  const map=new Map((templates||[]).map(t=>[t.kind,t]));
  const stats={picked:0,sent:0,failed:0,skipped:0};
  for(let i=0;i<Math.min(10,Math.max(1,Number(limit)||10))&&Date.now()-started<30000;i++){
    const claimed=await staged('claim',()=>rpc('krug_telegram_claim',{p_limit:1}));
    const row=Array.isArray(claimed)?claimed[0]:null;
    if(!row)break;stats.picked++;
    let payload;
    try{
      if(row.campaign_id){
        payload=content.render(row.context?._content||{title:'',body:row.text,button_text:row.button_text||'',button_target:row.button_target,button_url:row.button_url},row.context);
      }else{
        const template=map.get(row.kind);
        payload=template?content.render(template,row.context):{text:row.text,button_text:row.button_text,button_target:row.button_target,button_url:row.button_url};
        if(!payload.text)throw Error('TEMPLATE_INVALID');
        if(row.kind==='settings'){
          const p=await staged('load_preferences',()=>rpc('krug_telegram_preferences',{p_telegram_user_id:row.telegram_user_id}));
          payload.text+=`\n\nНовости: ${p.marketing_enabled?'вкл':'выкл'}. Напоминания: ${p.reminders_enabled?'вкл':'выкл'}. За 30 мин: ${p.reminder_30m_enabled?'вкл':'выкл'}.`;
        }
      }
    }catch(error){
      if(error?.stage)throw error;
      await staged('finish_template_invalid',()=>rpc('krug_telegram_finish',{p_id:row.id,p_lease:row.lease_token,p_result:'failed',p_code:'TEMPLATE_INVALID'}));stats.failed++;continue;
    }
    const canDeliver=await staged('delivery_check',()=>rpc('krug_telegram_delivery_check',{p_id:row.id,p_lease:row.lease_token}));
    if(!canDeliver){stats.skipped++;continue;}
    let result;
    try{result=await staged('telegram_send',()=>sendMessage({...row,...payload}));}
    catch(error){
      if(error?.stage&&error.stage!=='telegram_send')throw error;
      const outcome=error.status===403?'blocked':error.status===429?'retry':'failed';
      await staged('finish_delivery_error',()=>rpc('krug_telegram_finish',{p_id:row.id,p_lease:row.lease_token,p_result:outcome,
        p_code:error.uncertain?'DELIVERY_UNCERTAIN':error.status?`TELEGRAM_${error.status}`:'DELIVERY_FAILED',p_retry_after:error.retryAfter||60}));
      stats.failed++;continue;
    }
    await staged('finish_sent',()=>rpc('krug_telegram_finish',{p_id:row.id,p_lease:row.lease_token,p_result:'sent',p_message_id:result.message_id}));stats.sent++;
  }
  return stats;
}
module.exports={rpc,safeEqual,requireSecret,botCall,health,sendMessage,processDueNotifications};
