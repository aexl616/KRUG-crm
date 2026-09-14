const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'../../api');
const handlerPath=path.join(root,'bookings/cancel.js'),authPath=path.join(root,'_lib/telegram-auth.js'),dbPath=path.join(root,'_lib/supabase-server.js');
function load(user){
 for(const p of [handlerPath,authPath,dbPath])delete require.cache[p];const calls=[];
 require.cache[authPath]={id:authPath,filename:authPath,loaded:true,exports:{resolveTelegramUser:()=>user,mapTelegramAuthError:()=>null}};
 require.cache[dbPath]={id:dbPath,filename:dbPath,loaded:true,exports:{supabaseServer:async(route,options)=>{calls.push({route,payload:JSON.parse(options.body)});return {status:'cancelled'};}}};
 return {handler:require(handlerPath),calls};
}
const response=()=>({setHeader(){},status(n){this.code=n;return this;},json(b){this.body=b;}});
test('client cancellation binds verified Telegram identity and cannot accept body identity',async()=>{
 const {handler,calls}=load({id:99}),res=response(),requestId='11111111-1111-4111-8111-111111111111';
 await handler({method:'POST',headers:{},body:{requestId,telegramUserId:100}},res);
 assert.equal(res.code,200);assert.deepEqual(calls,[{route:'rpc/krug_telegram_client_cancel',payload:{p_request_id:requestId,p_telegram_user_id:99}}]);
});
test('unverified or absent identity cannot cancel a booking by knowing its request ID',async()=>{
 for(const user of [null,{id:99,unverified:true}]){
  const {handler,calls}=load(user),res=response();await handler({method:'POST',headers:{},body:{requestId:'11111111-1111-4111-8111-111111111111'}},res);
  assert.equal(res.code,401);assert.equal(calls.length,0);
 }
});
