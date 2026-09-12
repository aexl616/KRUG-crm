const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');

const handlerPath=path.resolve(__dirname,'../crm-auth.js');
const supabasePath=path.resolve(__dirname,'../_lib/supabase-server.js');
const httpPath=path.resolve(__dirname,'../_lib/http.js');
const session='11111111-1111-4111-8111-111111111111';

function response(){return {statusCode:200,body:null,headers:{},setHeader(name,value){this.headers[name]=value;},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};}
function load({rpcResult={token:session,user:{id:'u1',name:'AE XL',login:'admin',role:'owner',mustChangePassword:true}},rpcError=null,resolver=null}={}){
  const calls=[];for(const p of [handlerPath,supabasePath,httpPath])delete require.cache[p];
  require.cache[supabasePath]={id:supabasePath,filename:supabasePath,loaded:true,exports:{supabaseServer:async(route,options)=>{
    const call={route,method:options?.method||'GET',body:options?.body?JSON.parse(options.body):null};calls.push(call);
    if(rpcError)throw rpcError;
    if(resolver)return resolver(call,calls.length-1);
    return rpcResult;
  }}};
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
  const {handler,calls}=load({rpcResult:{user:{id:'u2',name:'Сотрудник',login:'staff',role:'engineer',mustChangePassword:false}}});const res=response();
  await handler(req({action:'session'},session),res);
  assert.equal(res.statusCode,200);assert.equal(calls[0].route,'rpc/krug_crm_session_get');
  assert.deepEqual(calls[0].body,{p_token:session});
});

test('password rotation is session-bound and never accepts a short password',async()=>{
  {
    const {handler,calls}=load();const res=response();
    await handler(req({action:'changePassword',password:'short'},session),res);
    assert.equal(res.statusCode,400);assert.equal(res.body.error,'CRM_PASSWORD_WEAK');assert.equal(calls.length,0);
  }
  {
    const {handler,calls}=load({rpcResult:{user:{id:'u1',name:'AE XL',login:'admin',role:'owner',mustChangePassword:false}}});const res=response();
    await handler(req({action:'changePassword',password:'new-secure-password'},session),res);
    assert.equal(res.statusCode,200);assert.equal(calls[0].route,'rpc/krug_crm_change_password');
    assert.deepEqual(calls[0].body,{p_token:session,p_password:'new-secure-password'});
  }
});

test('staff provisioning is session-bound and maps fields to server RPCs',async()=>{
  const remote={id:'u3',name:'Миша',login:'mike',role:'engineer',active:true,mustChangePassword:true};
  const {handler,calls}=load({rpcResult:remote});const res=response();
  await handler(req({action:'staffCreate',name:'Миша',login:'mike',password:'temporary-pass',role:'engineer'},session),res);
  assert.equal(res.statusCode,200);assert.equal(calls[0].route,'rpc/krug_crm_staff_create');
  assert.deepEqual(calls[0].body,{p_token:session,p_login:'mike',p_password:'temporary-pass',p_name:'Миша',p_role:'engineer'});
});

test('staff update and delete use the authenticated employee session',async()=>{
  {
    const {handler,calls}=load({rpcResult:{id:'u3',name:'Миша',login:'mike',role:'staff',active:false}});const res=response();
    await handler(req({action:'staffUpdate',userId:'u3',name:'Миша',role:'staff',active:false},session),res);
    assert.equal(res.statusCode,200);assert.equal(calls[0].route,'rpc/krug_crm_staff_update');
    assert.deepEqual(calls[0].body,{p_token:session,p_user_id:'u3',p_name:'Миша',p_role:'staff',p_active:false});
  }
  {
    const {handler,calls}=load({rpcResult:{id:'u3',deleted:true}});const res=response();
    await handler(req({action:'staffDelete',userId:'u3'},session),res);
    assert.equal(res.statusCode,200);assert.equal(calls[0].route,'rpc/krug_crm_staff_delete');
    assert.deepEqual(calls[0].body,{p_token:session,p_user_id:'u3'});
  }
});

test('owner bootstrap validates legacy admin authority, rotates the old password and returns a forced-rotation session',async()=>{
  const {handler,calls}=load({resolver:call=>{
    if(call.route==='rpc/krug_admin_app_overview')return {ok:true};
    if(call.route.startsWith('crm_staff_users?'))return [{user_id:'u1',login:'admin',name:'AE XL',role:'owner',active:true}];
    if(call.route.startsWith('crm_staff_sessions?')&&call.method==='DELETE')return [];
    if(call.route==='crm_staff_sessions'&&call.method==='POST')return [{token:session,user_id:'u1',expires_at:'2030-01-01T00:00:00Z'}];
    if(call.route==='rpc/krug_crm_change_password')return {user:{id:'u1',mustChangePassword:false}};
    throw new Error(`unexpected ${call.method} ${call.route}`);
  }});const res=response();
  await handler(req({action:'bootstrapOwner',adminToken:'existing-admin-key-123'}),res);
  assert.equal(res.statusCode,200);assert.equal(res.body.data.token,session);assert.equal(res.body.data.user.mustChangePassword,true);
  assert.equal(calls[0].route,'rpc/krug_admin_app_overview');
  assert.equal(calls.some(call=>call.route==='rpc/krug_crm_change_password'),true);
  const rotation=calls.find(call=>call.route==='rpc/krug_crm_change_password');
  assert.equal(rotation.body.p_token,session);assert.equal(typeof rotation.body.p_password,'string');assert.ok(rotation.body.p_password.length>=32);
});

test('owner bootstrap rejects obviously malformed recovery key before database access',async()=>{
  const {handler,calls}=load();const res=response();
  await handler(req({action:'bootstrapOwner',adminToken:'short'}),res);
  assert.equal(res.statusCode,400);assert.equal(res.body.error,'INVALID_BOOTSTRAP_TOKEN');assert.equal(calls.length,0);
});

test('staff schedule actions bind the session and optimistic version',async()=>{
  const {handler,calls}=load({rpcResult:{version:2}});const res=response();
  const profile={schedule:{weekly:{},exceptions:{}},serviceIds:['recording']};
  await handler(req({action:'staffScheduleSave',staffId:'u2',profile,expectedVersion:1},session),res);
  assert.equal(res.statusCode,200);assert.equal(calls[0].route,'rpc/krug_crm_staff_schedule');
  assert.deepEqual(calls[0].body,{p_token:session,p_staff_id:'u2',p_profile:profile,p_expected_version:1});
});

test('staff schedule conflicts are reported without overwriting another edit',async()=>{
  const {handler}=load({rpcError:new Error('STAFF_SCHEDULE_CONFLICT')});const res=response();
  await handler(req({action:'staffScheduleSave',staffId:'u2',profile:{},expectedVersion:1},session),res);
  assert.equal(res.statusCode,409);assert.equal(res.body.error,'STAFF_SCHEDULE_CONFLICT');
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
