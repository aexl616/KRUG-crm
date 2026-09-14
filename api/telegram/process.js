'use strict';
const {rpc,safeEqual,requireSecret,processDueNotifications}=require('../_lib/telegram');
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
      return res.status(200).json({ok:true});
    }
    const bearer=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
    if(!safeEqual(bearer,process.env.TELEGRAM_CRON_SECRET))return apiError(res,401,'CRON_UNAUTHORIZED');
    requireSecret();
    const stats=await processDueNotifications(10);
    return res.status(200).json({ok:true,stats});
  }catch(error){
    const unavailable=['SUPABASE_SERVER_SECRET_REQUIRED','TELEGRAM_BOT_TOKEN_REQUIRED'].includes(error.message);
    return apiError(res,unavailable?503:502,unavailable?error.message:'TELEGRAM_PROCESS_FAILED');
  }
};
