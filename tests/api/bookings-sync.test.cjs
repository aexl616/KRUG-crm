const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');

const syncPath=path.resolve(__dirname,'../../api/bookings/sync.js');
const supabasePath=path.resolve(__dirname,'../../api/_lib/supabase-server.js');
const httpPath=path.resolve(__dirname,'../../api/_lib/http.js');
const authPath=path.resolve(__dirname,'../../api/_lib/telegram-auth.js');

function loadHandler({telegramUser={id:123},supabaseReply=[]}={}){
  const calls=[];
  for(const p of [syncPath,supabasePath,httpPath,authPath]) delete require.cache[p];
  require.cache[supabasePath]={id:supabasePath,filename:supabasePath,loaded:true,exports:{supabaseServer:async(route,options)=>{calls.push({route,options,body:options?.body?JSON.parse(options.body):null});return supabaseReply;}}};
  require.cache[httpPath]={id:httpPath,filename:httpPath,loaded:true,exports:{
    applyPublicCors:()=>false,
    readJsonBody:req=>req.body,
    apiError:(res,status,error,message)=>res.status(status).json({ok:false,error,message})
  }};
  require.cache[authPath]={id:authPath,filename:authPath,loaded:true,exports:{
    resolveTelegramUser:()=>telegramUser,
    mapTelegramAuthError:error=>error?.auth || null
  }};
  const handler=require(syncPath);
  return {handler,calls};
}

function response(){
  return {
    statusCode:200,body:null,headers:{},
    setHeader(name,value){this.headers[name]=value;},
    status(code){this.statusCode=code;return this;},
    json(body){this.body=body;return this;}
  };
}

test('sync derives booking history exclusively from authenticated Telegram identity',async()=>{
  const rows=[{id:'b1',requestId:'11111111-1111-4111-8111-111111111111'}];
  const {handler,calls}=loadHandler({telegramUser:{id:777},supabaseReply:rows});
  const req={method:'POST',body:{requestIds:['attacker-controlled-id']}};
  const res=response();
  await handler(req,res);
  assert.equal(res.statusCode,200);
  assert.deepEqual(res.body,{ok:true,bookings:rows});
  assert.equal(calls.length,1);
  assert.equal(calls[0].route,'rpc/krug_list_bookings_for_telegram');
  assert.deepEqual(calls[0].body,{p_telegram_user_id:777});
});

test('empty request body still returns authenticated user history',async()=>{
  const rows=[{id:'b1'}];
  const {handler}=loadHandler({supabaseReply:rows});
  const res=response();
  await handler({method:'POST',body:{}},res);
  assert.equal(res.statusCode,200);
  assert.deepEqual(res.body.bookings,rows);
});

test('invalid or missing Telegram identity is rejected before database access',async()=>{
  for(const telegramUser of [null,{id:0},{id:'not-a-number'}]){
    const {handler,calls}=loadHandler({telegramUser});
    const res=response();
    await handler({method:'POST',body:{}},res);
    assert.equal(res.statusCode,401);
    assert.equal(res.body.error,'TELEGRAM_AUTH_REQUIRED');
    assert.equal(calls.length,0);
  }
});

test('mapped Telegram auth failures are preserved',async()=>{
  const authError=Object.assign(new Error('expired'),{auth:[401,'TELEGRAM_AUTH_EXPIRED','Открой Mini App заново.']});
  for(const p of [syncPath,supabasePath,httpPath,authPath]) delete require.cache[p];
  require.cache[supabasePath]={id:supabasePath,filename:supabasePath,loaded:true,exports:{supabaseServer:async()=>[]}};
  require.cache[httpPath]={id:httpPath,filename:httpPath,loaded:true,exports:{applyPublicCors:()=>false,readJsonBody:req=>req.body,apiError:(res,status,error,message)=>res.status(status).json({ok:false,error,message})}};
  require.cache[authPath]={id:authPath,filename:authPath,loaded:true,exports:{resolveTelegramUser:()=>{throw authError;},mapTelegramAuthError:error=>error.auth||null}};
  const handler=require(syncPath);const res=response();
  await handler({method:'POST',body:{}},res);
  assert.equal(res.statusCode,401);assert.equal(res.body.error,'TELEGRAM_AUTH_EXPIRED');
});
