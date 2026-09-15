'use strict';
const {rpc,safeEqual,requireSecret,processDueNotifications,processDueNotificationsQuietly,health}=require('../_lib/telegram');
const {apiError,readJsonBody}=require('../_lib/http');
module.exports=async function(req,res){
  res.setHeader('Cache-Control','no-store');
  const webhook=req.query?.mode==='webhook';
  if(webhook?req.method!=='POST':!['POST','GET'].includes(req.method))return apiError(res,405,'METHOD_NOT_ALLOWED');
  try{
    if(webhook){
      if(!safeEqual(req.headers['x-telegram-bot-api-secret-token'],process.env.TELEGRAM_WEBHOOK_SECRET))return apiError(res,401,'WEBHOOK_UNAUTHORIZED');
      requireSecret();
      const body=readJsonBody(req);
      if(!body||!Number.isSafeInteger(body.update_id))return apiError(res,400,'INVALID_UPDATE');
      const msg=body.message,member=body.my_chat_member;
      const chat=msg?.chat||member?.chat;
      if(chat?.type!=='private')return res.status(200).json({ok:true});
      const user=msg?.from||member?.from;
      const userId=Number(chat.id);
      if(!Number.isSafeInteger(userId)||userId<=0||msg&&(Number(user?.id)!==userId||user.is_bot))return apiError(res,400,'INVALID_USER');
      const command=String(msg?.text||'').trim().split(/\s/)[0].split('@')[0].toLowerCase();
      const accepted=['/start','/settings','/marketing_on','/marketing_off','/reminders_on','/reminders_off','/30m_on','/30m_off'];
      if(!member&&!accepted.includes(command))return res.status(200).json({ok:true});
      const blocked=member?member.new_chat_member?.status==='kicked':null;
      await rpc('krug_telegram_update',{p_update_id:body.update_id,p_user_id:userId,p_name:user?.first_name||'Гость',p_username:user?.username||null,p_command:command,p_blocked:blocked});
      const response=res.status(200).json({ok:true});
      await processDueNotificationsQuietly(1);
      return response;
    }
    const bearer=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
    if(!safeEqual(bearer,process.env.TELEGRAM_CRON_SECRET))return apiError(res,401,'CRON_UNAUTHORIZED');
    requireSecret();
    if(req.query?.mode==='setup'){
      if(req.method!=='POST')return apiError(res,405,'METHOD_NOT_ALLOWED');
      await require('../../scripts/setup-telegram.cjs').setupTelegram();
      return res.status(200).json({ok:true,health:await health()});
    }
    if(req.query?.mode==='health')return res.status(200).json({ok:true,health:await health()});
    const stats=await processDueNotifications(10);
    return res.status(200).json({ok:true,stats});
  }catch(error){
    const code=String(error.details?.code||'');
    const stage=String(error.stage||'unknown').replace(/[^a-z0-9_]/gi,'').slice(0,40)||'unknown';
    const databaseMessage=String(error.details?.message||'').replace(/[\r\n\t]+/g,' ').replace(/[^\x20-\x7EА-Яа-яЁё]/g,'').slice(0,180)||null;
    console.error('TELEGRAM_PROCESS_FAILED',JSON.stringify({stage,database_code:/^[A-Z0-9]{3,12}$/.test(code)?code:null,database_message:databaseMessage,status:Number(error.status)||null,error_type:['TimeoutError','AbortError','TypeError'].includes(error.name)?error.name:null}));
    const unavailable=['SUPABASE_SERVER_SECRET_REQUIRED','TELEGRAM_BOT_TOKEN_REQUIRED'].includes(error.message);
    return apiError(res,unavailable?503:502,unavailable?error.message:'TELEGRAM_PROCESS_FAILED');
  }
};
