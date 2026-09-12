const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');

const handlerPath=path.resolve(__dirname,'../crm-auth.js');
const supabasePath=path.resolve(__dirname,'../_lib/supabase-server.js');
const httpPath=path.resolve(__dirname,'../_lib/http.js');
const session='11111111-1111-4111-8111-111111111111';

function response(){return {statusCode:200,body:null,headers:{},setHeader(name,value){this.headers[name]=value;},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};}
function load({rpcResult={token:session,user:{id:'u1',name:'AE XL',login:'admin',role:'owner'}},rpcError=null}={}){
  const calls=[];for(const p of [handlerPath,supabasePath,httpPath])delete require.cache[p];
  require.cache[supabasePath]={id:supabasePath,filename:supabasePath,loaded:true,exports:{supabaseServer:async(route,options)=>{calls.push({route,body:options?.body?JSON.parse(options.body):null});if(rpcError)throw rpcError;return rpcResult;}}};
  require.cache[httpPath]={id:httpPath,filename:httpPath,loaded:true,exports:{readJsonBody:req=>req.body,apiError:(res,status,error,message)=>res.status(status).json({ok:false,error,message})}};
  return {handler:require(handlerPath),calls};
}
function req(body,token=''){return {method:'POST',headers:token?{authorization:`Bearer ${token}`}:{},body};}

test('login sends credentials only to the server-side login RPC',async()=>{
  const {handler,calls}=load();const res=response();
  await handler(req({action:'login',login:'admin',password:'secret'}),res);
  assert.equal(res.statusCode,200);assert.equal(res.body.ok,true);
  assert.equal(calls.length,1);assert.equal(calls[0].route,'rpc/krug_crm_login');
  assert.deepEqual(calls[0].body,{p_login:'admin',p_password:'secret'});
});

test('invalid login is returned as 401 without leaking details',async()=>{
  const {handler}=load({rpcError:new Error('CRM_AUTH_INVALID')});const res=response();
  await handler(req({action:'login',login:'admin',password:'wrong'}),res);
  assert.equal(res.statusCode,401);assert.equal(res.body.error,'CRM_AUTH_INVALID');
});

test('session validation uses bearer UUID and session RPC',async()=>{
  const {handler,calls}=load({rpcResult:{user:{id:'u2',name:'Сотрудник',login:'staff',role:'engineer'}}});const res=response();
  await handler(req({action:'session'},session),res);
  assert.equal(res.statusCode,200);assert.equal(calls[0].route,'rpc/krug_crm_session_get');
  assert.deepEqual(calls[0].body,{p_token:session});
});

test('logout invalidates the server session',async()=>{
  const {handler,calls}=load({rpcResult:true});const res=response();
  await handler(req({action:'logout'},session),res);
  assert.equal(res.statusCode,200);assert.equal(calls[0].route,'rpc/krug_crm_logout');
});

test('malformed session is rejected before RPC',async()=>{
  const {handler,calls}=load();const res=response();
  await handler(req({action:'session'},'not-a-session'),res);
  assert.equal(res.statusCode,401);assert.equal(res.body.error,'CRM_SESSION_REQUIRED');assert.equal(calls.length,0);
});
