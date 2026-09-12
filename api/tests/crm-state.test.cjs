const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');

const handlerPath=path.resolve(__dirname,'../crm-state.js');
const supabasePath=path.resolve(__dirname,'../_lib/supabase-server.js');
const httpPath=path.resolve(__dirname,'../_lib/http.js');
const session='11111111-1111-4111-8111-111111111111';

function response(){return {statusCode:200,body:null,headers:{},setHeader(name,value){this.headers[name]=value;},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};}
function load({rpcResult={version:3,data:{clients:[],bookings:[],studioBlocks:[]},permissions:{read:['clients','bookings','studioBlocks'],write:['clients','bookings','studioBlocks']}},rpcError=null}={}){
  const calls=[];for(const p of [handlerPath,supabasePath,httpPath])delete require.cache[p];
  require.cache[supabasePath]={id:supabasePath,filename:supabasePath,loaded:true,exports:{supabaseServer:async(route,options)=>{calls.push({route,body:options?.body?JSON.parse(options.body):null});if(rpcError)throw rpcError;return rpcResult;}}};
  require.cache[httpPath]={id:httpPath,filename:httpPath,loaded:true,exports:{readJsonBody:req=>req.body,apiError:(res,status,error,message)=>res.status(status).json({ok:false,error,message})}};
  return {handler:require(handlerPath),calls};
}
function req(body,token=session){return {method:'POST',headers:{authorization:`Bearer ${token}`},body};}

test('get reads shared CRM state through employee session RPC',async()=>{
  const {handler,calls}=load();const res=response();await handler(req({action:'get'}),res);
  assert.equal(res.statusCode,200);assert.equal(res.body.ok,true);assert.equal(calls[0].route,'rpc/krug_crm_state_get_session');assert.deepEqual(calls[0].body,{p_session:session});
});

test('put sends an optimistic update through the role-scoped session RPC',async()=>{
  const state={clients:[],bookings:[],studioBlocks:[]};
  const {handler,calls}=load({rpcResult:{version:4,data:state,permissions:{read:Object.keys(state),write:Object.keys(state)}}});const res=response();
  await handler(req({action:'put',expectedVersion:3,state,updatedBy:'Сотрудник'}),res);
  assert.equal(res.statusCode,200);assert.equal(calls[0].route,'rpc/krug_crm_state_put_session');
  assert.deepEqual(calls[0].body,{p_session:session,p_expected_version:3,p_data:state,p_updated_by:'Сотрудник'});
});

test('put rejects malformed version before database access',async()=>{
  const {handler,calls}=load();const res=response();await handler(req({action:'put',expectedVersion:-1,state:{}}),res);
  assert.equal(res.statusCode,400);assert.equal(res.body.error,'INVALID_VERSION');assert.equal(calls.length,0);
});

test('missing or malformed employee session is rejected before database access',async()=>{
  for(const token of ['', 'admin-token']){
    const {handler,calls}=load();const res=response();
    await handler({method:'POST',headers:token?{authorization:`Bearer ${token}`}:{},body:{action:'get'}},res);
    assert.equal(res.statusCode,401);assert.equal(res.body.error,'CRM_SESSION_REQUIRED');assert.equal(calls.length,0);
  }
});

test('expired sessions stay explicit',async()=>{
  const {handler}=load({rpcError:new Error('CRM_SESSION_INVALID')});const res=response();await handler(req({action:'get'}),res);
  assert.equal(res.statusCode,401);assert.equal(res.body.error,'CRM_SESSION_INVALID');
});

test('read-only staff cannot mutate shared state',async()=>{
  const {handler}=load({rpcError:new Error('CRM_FORBIDDEN')});const res=response();
  await handler(req({action:'put',expectedVersion:3,state:{clients:[],bookings:[],studioBlocks:[]}}),res);
  assert.equal(res.statusCode,403);assert.equal(res.body.error,'CRM_FORBIDDEN');
});

test('state conflicts stay explicit instead of becoming generic 502s',async()=>{
  const {handler}=load({rpcError:new Error('CRM_STATE_CONFLICT:7')});const res=response();
  await handler(req({action:'put',expectedVersion:3,state:{clients:[],bookings:[],studioBlocks:[]}}),res);
  assert.equal(res.statusCode,409);assert.equal(res.body.error,'CRM_STATE_CONFLICT');
});
