const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const base=path.resolve(__dirname,'../../api');
const id='11111111-1111-4111-8111-111111111111';
const body={requestId:id,serviceId:'recording',date:'2030-01-02',startTime:'10:00',durationHours:1,client:{name:'Анна',phone:'+79991234567',telegramUserId:123}};
const res=()=>({statusCode:200,setHeader(){},status(n){this.statusCode=n;return this},json(data){this.body=data;return this}});
function setup(error=null){
 const calls=[];
 const mock=(file,exports)=>{const p=path.join(base,file);require.cache[p]={id:p,filename:p,loaded:true,exports};};
 mock('_lib/supabase-server.js',{supabaseServer:async(route,options)=>{calls.push({route,body:JSON.parse(options.body)});if(error)throw Error(error);return {id:'booking',staffId:'u1'};}});
 mock('_lib/telegram-auth.js',{resolveTelegramUser:()=>({id:123}),mapTelegramAuthError:()=>null});
 mock('_lib/telegram.js',{processDueNotifications:async()=>{}});
 mock('_lib/http.js',{applyPublicCors:()=>false,readJsonBody:r=>r.body,apiError:(r,n,error,message)=>r.status(n).json({ok:false,error,message})});
 const p=path.join(base,'bookings.js');delete require.cache[p];return {handler:require(p),calls};
}
test('booking sends optional staff preference to atomic v4 RPC and binds Telegram identity',async()=>{
 for(const staffId of [null,'u2']){
  const {handler,calls}=setup(),r=res();await handler({method:'POST',body:{...body,staffId}},r);
  assert.equal(r.statusCode,201);assert.equal(calls[0].route,'rpc/krug_create_booking_v4');assert.equal(calls[0].body.p_staff_id,staffId);assert.equal(calls[0].body.p_telegram_user_id,123);
 }
});
test('staff race and required-selection errors remain actionable',async()=>{
 for(const code of ['STAFF_UNAVAILABLE','STAFF_REQUIRED','STAFF_NOT_SUPPORTED']){
  const {handler}=setup(code),r=res();await handler({method:'POST',body},r);
  assert.equal(r.body.error,code);assert.equal(r.statusCode,code==='STAFF_UNAVAILABLE'?409:400);
 }
});
test('malformed staff ID is rejected before database access',async()=>{
 const {handler,calls}=setup(),r=res();await handler({method:'POST',body:{...body,staffId:'x'.repeat(121)}},r);
 assert.equal(r.statusCode,400);assert.equal(calls.length,0);
});
