const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');

const handlerPath=path.resolve(__dirname,'../crm-state.js');
const supabasePath=path.resolve(__dirname,'../_lib/supabase-server.js');
const httpPath=path.resolve(__dirname,'../_lib/http.js');

function response(){return {statusCode:200,body:null,headers:{},setHeader(name,value){this.headers[name]=value;},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};}
function load({rpcResult={version:3,data:{clients:[],bookings:[],payments:[],expenses:[],payouts:[],studioBlocks:[]}},rpcError=null}={}){
  const calls=[];for(const p of [handlerPath,supabasePath,httpPath])delete require.cache[p];
  require.cache[supabasePath]={id:supabasePath,filename:supabasePath,loaded:true,exports:{supabaseServer:async(route,options)=>{calls.push({route,body:options?.body?JSON.parse(options.body):null});if(rpcError)throw rpcError;return rpcResult;}}};
  require.cache[httpPath]={id:httpPath,filename:httpPath,loaded:true,exports:{readJsonBody:req=>req.body,apiError:(res,status,error,message)=>res.status(status).json({ok:false,error,message})}};
  return {handler:require(handlerPath),calls};
}
function req(body,token='admin-token'){return {method:'POST',headers:{authorization:`Bearer ${token}`},body};}

test('get reads shared CRM state through the authenticated RPC',async()=>{
  const {handler,calls}=load();const res=response();await handler(req({action:'get'}),res);
  assert.equal(res.statusCode,200);assert.equal(res.body.ok,true);assert.equal(calls[0].route,'rpc/krug_crm_state_get');assert.deepEqual(calls[0].body,{p_token:'admin-token'});
});

test('put sends only an object state with an optimistic version',async()=>{
  const state={clients:[],bookings:[],payments:[],expenses:[],payouts:[],studioBlocks:[]};
  const {handler,calls}=load({rpcResult:{version:4,data:state}});const res=response();
  await handler(req({action:'put',expectedVersion:3,state,updatedBy:'AE XL'}),res);
  assert.equal(res.statusCode,200);assert.equal(calls[0].route,'rpc/krug_crm_state_put');
  assert.deepEqual(calls[0].body,{p_token:'admin-token',p_expected_version:3,p_data:state,p_updated_by:'AE XL'});
});

test('put rejects malformed version before database access',async()=>{
  const {handler,calls}=load();const res=response();await handler(req({action:'put',expectedVersion:-1,state:{}}),res);
  assert.equal(res.statusCode,400);assert.equal(res.body.error,'INVALID_VERSION');assert.equal(calls.length,0);
});

test('missing admin token is rejected',async()=>{
  const {handler,calls}=load();const res=response();await handler({method:'POST',headers:{},body:{action:'get'}},res);
  assert.equal(res.statusCode,401);assert.equal(res.body.error,'ADMIN_TOKEN_REQUIRED');assert.equal(calls.length,0);
});

test('state conflicts stay explicit instead of becoming generic 502s',async()=>{
  const {handler}=load({rpcError:new Error('CRM_STATE_CONFLICT:7')});const res=response();
  await handler(req({action:'put',expectedVersion:3,state:{clients:[],bookings:[],payments:[],expenses:[],payouts:[],studioBlocks:[]}}),res);
  assert.equal(res.statusCode,409);assert.equal(res.body.error,'CRM_STATE_CONFLICT');
});
