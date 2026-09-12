const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');

const handlerPath=path.resolve(__dirname,'../app-admin.js');
const supabasePath=path.resolve(__dirname,'../_lib/supabase-server.js');
const httpPath=path.resolve(__dirname,'../_lib/http.js');
const bookingId='11111111-1111-4111-8111-111111111111';

function response(){
  return {
    statusCode:200,body:null,headers:{},
    setHeader(name,value){this.headers[name]=value;},
    status(code){this.statusCode=code;return this;},
    json(body){this.body=body;return this;}
  };
}

function load({rpcResult={id:bookingId,status:'in_progress'},rpcError=null}={}){
  const calls=[];
  for(const p of [handlerPath,supabasePath,httpPath]) delete require.cache[p];
  require.cache[supabasePath]={id:supabasePath,filename:supabasePath,loaded:true,exports:{supabaseServer:async(route,options)=>{
    calls.push({route,body:options?.body?JSON.parse(options.body):null});
    if(rpcError) throw rpcError;
    return rpcResult;
  }}};
  require.cache[httpPath]={id:httpPath,filename:httpPath,loaded:true,exports:{
    readJsonBody:req=>req.body,
    apiError:(res,status,error,message)=>res.status(status).json({ok:false,error,message})
  }};
  return {handler:require(handlerPath),calls};
}

function req(body,token='secret-admin-token'){
  return {method:'POST',headers:{authorization:`Bearer ${token}`},body};
}

test('startBooking calls only the start RPC with authenticated admin token and booking id',async()=>{
  const {handler,calls}=load();const res=response();
  await handler(req({action:'startBooking',bookingId}),res);
  assert.equal(res.statusCode,200);assert.equal(res.body.ok,true);
  assert.equal(calls.length,1);assert.equal(calls[0].route,'rpc/krug_admin_start_booking');
  assert.deepEqual(calls[0].body,{p_token:'secret-admin-token',p_booking_id:bookingId});
});

test('startBooking rejects invalid booking ids before database access',async()=>{
  const {handler,calls}=load();const res=response();
  await handler(req({action:'startBooking',bookingId:'not-a-uuid'}),res);
  assert.equal(res.statusCode,400);assert.equal(res.body.error,'INVALID_BOOKING_ID');assert.equal(calls.length,0);
});

test('server status transition conflicts keep their specific API error',async()=>{
  const {handler}=load({rpcError:new Error('STATUS_CHANGE_NOT_ALLOWED')});const res=response();
  await handler(req({action:'startBooking',bookingId}),res);
  assert.equal(res.statusCode,409);assert.equal(res.body.error,'STATUS_CHANGE_NOT_ALLOWED');
});

test('settlement passes actual paid amount and method to the server RPC',async()=>{
  const {handler,calls}=load({rpcResult:{id:bookingId,status:'completed',paymentStatus:'paid',paidAmount:4200}});const res=response();
  await handler(req({action:'settleBooking',bookingId,paidAmount:4200,paymentMethod:'Перевод'}),res);
  assert.equal(res.statusCode,200);assert.equal(calls[0].route,'rpc/krug_admin_settle_booking');
  assert.deepEqual(calls[0].body,{p_token:'secret-admin-token',p_booking_id:bookingId,p_paid_amount:4200,p_payment_method:'Перевод'});
});

test('missing admin token is rejected before any RPC',async()=>{
  const {handler,calls}=load();const res=response();
  await handler({method:'POST',headers:{},body:{action:'startBooking',bookingId}},res);
  assert.equal(res.statusCode,401);assert.equal(res.body.error,'ADMIN_TOKEN_REQUIRED');assert.equal(calls.length,0);
});
