const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const session='11111111-1111-4111-8111-111111111111';
const base=path.resolve(__dirname,'../../api'),supabase=path.join(base,'_lib/supabase-server.js');
const lib=path.join(base,'_lib/telegram.js');
function response(){return {statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(b){this.body=b;return this;},end(){}};}
function load(route,db=async()=>({}),hasSecret=true){
 for(const p of [lib,supabase,path.join(base,route)])delete require.cache[p];
 const calls=[];
 require.cache[supabase]={id:supabase,filename:supabase,loaded:true,exports:{hasServerSecret:()=>hasSecret,supabaseServer:async(p,o)=>{const b=o?.body?JSON.parse(o.body):null;calls.push({p,b});return db(p,b);}}};
 return {handler:require(path.join(base,route)),calls};
}
const req=(body={},headers={authorization:`Bearer ${session}`})=>({method:'POST',headers,body,query:{}});
test('deployment setup requires cron authentication, uses configured webhook only, and sends no client messages',async()=>{
 const original=global.fetch,calls=[];
 process.env.TELEGRAM_CRON_SECRET='setup-cron';process.env.TELEGRAM_WEBHOOK_SECRET='a'.repeat(64);
 process.env.TELEGRAM_WEBHOOK_URL='https://krug-crm.vercel.app/api/telegram/process?mode=webhook';process.env.TELEGRAM_BOT_TOKEN='fixture';
 try{
  global.fetch=async(url,options)=>{calls.push({method:url.split('/').pop(),body:JSON.parse(options.body)});return {ok:true,json:async()=>({ok:true,result:{username:'fixture_bot',url:process.env.TELEGRAM_WEBHOOK_URL}})};};
  delete require.cache[require.resolve('../../scripts/setup-telegram.cjs')];
  const {handler}=load('telegram/process.js');
  const run=async(method,token)=>{const res=response();await handler({...req({url:'https://wrong.example'},{authorization:`Bearer ${token}`}),method,query:{mode:'setup'}},res);return res;};
  assert.equal((await run('POST','wrong')).statusCode,401);assert.equal((await run('GET','setup-cron')).statusCode,405);assert.equal(calls.length,0);
  const result=await run('POST','setup-cron');assert.equal(result.statusCode,200);assert.equal(result.body.health.webhook_matches,true);
  assert.equal(calls.find(c=>c.method==='setWebhook').body.url,process.env.TELEGRAM_WEBHOOK_URL);
  assert.equal(calls.some(c=>c.method==='sendMessage'),false);
 }finally{global.fetch=original;}
});
test('webhook authenticates independently of cron and CRM; signed updates bind private chat identity',async()=>{
 process.env.TELEGRAM_WEBHOOK_SECRET='webhook-fixture';process.env.TELEGRAM_CRON_SECRET='cron-fixture';
 const original=global.fetch,botCalls=[];
 try{
  global.fetch=async(url,options)=>{botCalls.push({url,body:JSON.parse(options.body)});return {ok:true,json:async()=>({ok:true,result:{message_id:9}})};};
  const {handler,calls}=load('telegram/process.js',async p=>p.startsWith('telegram_templates')?[]:p.endsWith('claim_one')?null:p.endsWith('telegram_update')?{accepted:true}:{});
  const body={update_id:1,message:{chat:{id:99,type:'private'},from:{id:99,first_name:'Анна'},text:'/start payload'}};
  for(const headers of [{},{authorization:'Bearer cron-fixture'},{'x-telegram-bot-api-secret-token':'wrong'}]){
   const res=response();await handler({...req(body,headers),query:{mode:'webhook'}},res);assert.equal(res.statusCode,401);
  }
  assert.equal(calls.length,0);
  const res=response();await handler({...req(body,{'x-telegram-bot-api-secret-token':'webhook-fixture'}),query:{mode:'webhook'}},res);
  assert.equal(res.statusCode,200);assert.equal(calls[0].p,'rpc/krug_telegram_update');assert.equal(calls[0].b.p_user_id,99);assert.equal(calls[0].b.p_command,'/start');
  const button=response();await handler({...req({...body,update_id:2,message:{...body.message,text:'Старт'}},{'x-telegram-bot-api-secret-token':'webhook-fixture'}),query:{mode:'webhook'}},button);
  assert.equal(button.statusCode,200);assert.deepEqual(calls.filter(c=>c.p==='rpc/krug_telegram_update').map(c=>c.b.p_command),['/start','/start']);
  const links=botCalls.find(call=>call.body.reply_markup?.inline_keyboard?.flat().some(item=>item.text==='Помощь'));
  assert.equal(links.body.reply_markup.inline_keyboard[0][0].url,'https://telegra.ph/Voprosy-i-Otvety-09-15');assert.equal(links.body.reply_markup.inline_keyboard[0][1].url,'https://t.me/ae_xl');
  const hide=response();await handler({...req({...body,update_id:3,message:{...body.message,text:'Скрыть меню'}},{'x-telegram-bot-api-secret-token':'webhook-fixture'}),query:{mode:'webhook'}},hide);
  assert.equal(hide.statusCode,200);assert.deepEqual(calls.filter(c=>c.p==='rpc/krug_telegram_update').map(c=>c.b.p_command),['/start','/start','/hide_menu']);
  assert.ok(botCalls.some(call=>call.body.reply_markup?.remove_keyboard===true));
  const mismatch=response();await handler({...req({...body,message:{...body.message,from:{id:100}}},{'x-telegram-bot-api-secret-token':'webhook-fixture'}),query:{mode:'webhook'}},mismatch);assert.equal(mismatch.statusCode,400);
  const group=response();await handler({...req({...body,message:{...body.message,chat:{id:-9,type:'group'}}},{'x-telegram-bot-api-secret-token':'webhook-fixture'}),query:{mode:'webhook'}},group);assert.equal(group.statusCode,200);assert.equal(calls.filter(c=>c.p==='rpc/krug_telegram_update').length,3);
 }finally{global.fetch=original;}
});
test('empty cron secret and legacy Mini App key cannot process queue',async()=>{
 delete process.env.TELEGRAM_CRON_SECRET;const {handler,calls}=load('telegram/process.js');
 for(const token of ['',session,'krug_old']){const res=response();await handler(req({}, {authorization:`Bearer ${token}`}),res);assert.equal(res.statusCode,401);}
 assert.equal(calls.length,0);
});
test('CRM session is forwarded and role/session errors stay explicit',async()=>{
 for(const [error,status] of [['CRM_FORBIDDEN',403],['CRM_SESSION_INVALID',401]]){
  const {handler}=load('telegram/admin.js',async()=>{throw Error(error);});const res=response();await handler(req({action:'saveTemplate'}),res);assert.equal(res.statusCode,status);
 }
 const {handler,calls}=load('telegram/admin.js');const res=response();await handler(req({action:'testSend',client_id:'fixture'}),res);
 assert.equal(calls[0].b.p_session,session);assert.equal(calls[0].b.p_action,'testSend');
 const legacy=response();await handler(req({}, {authorization:'Bearer krug_old'}),legacy);assert.equal(legacy.statusCode,401);
});
test('scheduled campaign cancellation uses its role-scoped RPC',async()=>{
 const campaign='22222222-2222-4222-8222-222222222222';const {handler,calls}=load('telegram/admin.js');const res=response();
 await handler(req({action:'cancelCampaign',id:campaign}),res);assert.equal(res.statusCode,200);
 assert.equal(calls[0].p,'rpc/krug_telegram_cancel_campaign');assert.deepEqual(calls[0].b,{p_session:session,p_id:campaign});
});
test('preview validates safe placeholders, and preferences require real Telegram initData even in test mode',async()=>{
 process.env.TELEGRAM_BOT_TOKEN='fixture-bot';delete process.env.TELEGRAM_AUTH_REQUIRED;
 const {handler,calls}=load('telegram/admin.js');
 const good=response();await handler(req({action:'preview',content:{body:'Привет, {client_name}',button_target:'none'}}),good);assert.equal(good.body.data.text,'Привет, Анна');
 const bad=response();await handler(req({action:'preview',content:{body:'{secret}'}}),bad);assert.equal(bad.statusCode,400);
 const preference=response();await handler(req({action:'preferences',telegramUserId:99,changes:{marketing_enabled:true}}),preference);assert.notEqual(preference.statusCode,200);assert.equal(calls.length,2);
});
test('sensitive Telegram endpoints fail closed without service credentials',async()=>{
 const {handler,calls}=load('telegram/admin.js',async()=>({}),false);const res=response();await handler(req(),res);assert.notEqual(res.statusCode,200);assert.equal(calls.length,0);
});
test('worker sends rendered Mini App buttons, rechecks eligibility, and records success once',async()=>{
 process.env.TELEGRAM_BOT_TOKEN='fixture-secret';let claimed=false,sends=[];
 const original=global.fetch;
 try{
  global.fetch=async(url,o)=>{sends.push(JSON.parse(o.body));return {ok:true,json:async()=>({ok:true,result:{message_id:7}})};};
  const {calls}=load('_lib/telegram.js',async(p)=>{
   if(p.startsWith('telegram_templates'))return [{kind:'welcome',title:'<b>КРУГ</b>',body:'Привет, {client_name}',button_text:'Открыть',button_target:'miniapp'}];
   if(p.endsWith('krug_telegram_claim_one')){if(claimed)return null;claimed=true;return {id:session,lease_token:session,telegram_user_id:99,kind:'welcome',context:{client_name:'Анна'}};}
   return true;
  });
  const result=await require(lib).processDueNotifications();assert.equal(result.sent,1);assert.equal(sends.length,1);assert.equal(sends[0].text,'<b>КРУГ</b>\n\nПривет, Анна');assert.equal(sends[0].parse_mode,'HTML');assert.ok(sends[0].reply_markup.inline_keyboard[0][0].web_app.url.startsWith('https://'));
  assert.ok(calls.find(c=>c.p.endsWith('delivery_check')));assert.equal(calls.find(c=>c.p.endsWith('finish')).b.p_message_id,7);
 }finally{global.fetch=original;}
});
test('command responses attach the persistent role-aware Reply Keyboard',async()=>{
 process.env.TELEGRAM_BOT_TOKEN='fixture-secret';let claimed=false,send;
 const original=global.fetch;
 try{
  global.fetch=async(url,o)=>{send=JSON.parse(o.body);return {ok:true,json:async()=>({ok:true,result:{message_id:10}})};};
  load('_lib/telegram.js',async(p)=>{
   if(p.startsWith('telegram_templates'))return [{kind:'settings',body:'Настройки',button_text:'Открыть',button_target:'miniapp'}];
   if(p.endsWith('claim_one')){if(claimed)return null;claimed=true;return {id:session,lease_token:session,telegram_user_id:99,kind:'settings',context:{_command_menu:true,_menu_started:true,_menu_role:'user'}};}
   if(p.endsWith('preferences'))return {marketing_enabled:false,reminders_enabled:true,reminder_30m_enabled:false};
   return true;
  });
  await require(lib).processDueNotifications();const labels=send.reply_markup.keyboard.flat().map(button=>button.text);
  assert.equal(send.reply_markup.is_persistent,true);assert.ok(labels.includes('Настройки'));assert.ok(labels.includes('Скрыть меню'));assert.ok(!labels.includes('Старт'));
  assert.equal(send.reply_markup.inline_keyboard,undefined);
 }finally{global.fetch=original;}
});
test('worker respects 429 retry_after, marks blocks, redacts descriptions, and never retries unknown delivery automatically',async()=>{
 const original=global.fetch;
 try{
  for(const [status,result,code] of [[429,'retry','TELEGRAM_429'],[403,'blocked','TELEGRAM_403'],[500,'failed','DELIVERY_UNCERTAIN'],[0,'failed','DELIVERY_UNCERTAIN']]){
   let claimed=false;
   global.fetch=async()=>{if(!status)throw Error('https://secret-token/private');return {ok:false,status,json:async()=>({ok:false,error_code:status,description:'private-token',parameters:{retry_after:125}})};};
   const {calls}=load('_lib/telegram.js',async(p)=>{
    if(p.startsWith('telegram_templates'))return [{kind:'test',body:'Тест',button_target:'none'}];
    if(p.endsWith('claim_one')){if(claimed)return null;claimed=true;return {id:session,lease_token:session,kind:'test',context:{},telegram_user_id:99};}return true;
   });
   await require(lib).processDueNotifications();const finish=calls.find(c=>c.p.endsWith('finish')).b;
   assert.equal(finish.p_result,result);assert.equal(finish.p_code,code);assert.ok(!JSON.stringify(calls).includes('private-token'));if(status===429)assert.equal(finish.p_retry_after,125);
  }
 }finally{global.fetch=original;}
});
test('lost database acknowledgement cannot cause a second send or requeue',async()=>{
 let sends=0,finishes=0;const original=global.fetch;
 try{
  global.fetch=async()=>{sends++;return {ok:true,json:async()=>({ok:true,result:{message_id:8}})};};
  load('_lib/telegram.js',async(p)=>{
   if(p.startsWith('telegram_templates'))return [{kind:'test',body:'Тест',button_target:'none'}];
   if(p.endsWith('claim_one'))return {id:session,lease_token:session,kind:'test',context:{},telegram_user_id:99};
   if(p.endsWith('finish')){finishes++;throw Error('database unavailable');}return true;
  });
  await assert.rejects(require(lib).processDueNotifications(),/database unavailable/);assert.equal(sends,1);assert.equal(finishes,1);
 }finally{global.fetch=original;}
});
