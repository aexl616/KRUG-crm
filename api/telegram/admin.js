'use strict';
const {rpc,requireSecret,health}=require('../_lib/telegram');
const {readJsonBody,apiError,applyPublicCors}=require('../_lib/http');
const {verifyInitData,mapTelegramAuthError}=require('../_lib/telegram-auth');
const content=require('../../telegram-content');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
module.exports=async function(req,res){
  if(applyPublicCors(req,res))return;
  res.setHeader('Cache-Control','no-store, private');
  if(req.method!=='POST')return apiError(res,405,'METHOD_NOT_ALLOWED');
  const body=readJsonBody(req);if(!body)return apiError(res,400,'INVALID_JSON');
  const action=String(body.action||'overview');
  try{
    requireSecret();let data;
    if(action==='preferences'){
      const user=verifyInitData(String(req.headers['x-telegram-init-data']||''),process.env.TELEGRAM_BOT_TOKEN);
      data=await rpc('krug_telegram_preferences',{p_telegram_user_id:user.id,p_changes:body.changes??null});
    }else{
      const session=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
      if(!UUID.test(session))return apiError(res,401,'CRM_SESSION_REQUIRED');
      if(!['overview','preview','saveTemplate','previewAudience','saveCampaign','launchCampaign','cancelCampaign','retry','testSend'].includes(action))return apiError(res,400,'UNKNOWN_ACTION');
      if(action==='preview'){
        await rpc('krug_telegram_admin',{p_session:session,p_action:'authorize'});
        try{data=content.render(body.content);}catch(error){return apiError(res,400,'TELEGRAM_TEMPLATE_INVALID',error.message);}
      }else if(action==='cancelCampaign'){
        const id=String(body.id||'');if(!UUID.test(id))return apiError(res,400,'TELEGRAM_CAMPAIGN_INVALID');
        data=await rpc('krug_telegram_cancel_campaign',{p_session:session,p_id:id});
      }else{
        data=await rpc('krug_telegram_admin',{p_session:session,p_action:action,p_payload:body});
        if(action==='overview')data.health=await health();
      }
    }
    return res.status(200).json({ok:true,data});
  }catch(error){
    const auth=mapTelegramAuthError(error);if(auth)return apiError(res,...auth);
    const code=String(error.message||'');
    if(code.includes('CRM_SESSION_INVALID'))return apiError(res,401,'CRM_SESSION_INVALID');
    if(code.includes('CRM_FORBIDDEN'))return apiError(res,403,'CRM_FORBIDDEN');
    if(code.includes('CONFLICT'))return apiError(res,409,'TELEGRAM_TEMPLATE_CONFLICT','Шаблон уже изменён. Обнови страницу.');
    if(code.includes('TELEGRAM_CAMPAIGN_NOT_SCHEDULED')||code.includes('TELEGRAM_CAMPAIGN_SENDING'))return apiError(res,409,'TELEGRAM_CAMPAIGN_NOT_CANCELLABLE','Рассылка уже отправляется или завершена. Обнови список.');
    if(/TELEGRAM_.*(INVALID|REQUIRED|UNAVAILABLE|NOT_FOUND)/.test(code))return apiError(res,400,'TELEGRAM_INVALID_REQUEST','Проверь текст, переменные, получателей и время отправки.');
    return apiError(res,502,'TELEGRAM_ADMIN_FAILED','Не удалось выполнить операцию Telegram.');
  }
};
