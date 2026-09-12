const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm'), fs=require('node:fs'), path=require('node:path');
const id='11111111-1111-4111-8111-111111111111';
const service={id:'recording',name:'Запись',active:true,publicVisible:true,publicCategory:'primary',pricingType:'hourly',priceTiers:[{durationHours:1,totalPrice:2345}],pricingRules:{hourlyRate:2345}};
const remote={id:'booking-1',requestId:id,serviceId:'recording',serviceName:'Запись',date:'2030-01-02',startTime:'10:00',durationHours:1,price:2500,status:'request',amountDue:2400,bonusReserved:100,paymentStatus:'unpaid'};
const draft=()=>({requestId:id,serviceId:'recording',date:'2030-01-02',startTime:'10:00',durationHours:1,client:{name:'Анна',phone:'+7 999 123-45-67'}});
function setup({initData='signed-test-data', storage=new Map(), failStorage=false}={}){
 const calls=[];let reply=async(url,opts)=>url.endsWith('/api/services')?{ok:true,services:[service]}:url.includes('/api/availability?')?{ok:true,availability:{date:'2030-01-02',closed:false,slots:['10:00']}}:url.endsWith('/sync')?{ok:true,bookings:[remote]}:{ok:true,booking:remote};
 const window={KrugConfig:{API_BASE:'https://backend.test',BOOKING_BACKEND:true},KrugTelegram:{getInitData:()=>initData,getTelegramUser:()=>({id:123})}};
 const context=vm.createContext({window,crypto:require('node:crypto').webcrypto,structuredClone,Intl,Date,URL,URLSearchParams,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>{if(failStorage)throw Error('quota');storage.set(k,v);}},fetch:async(url,opts)=>{calls.push({url,opts,body:opts.body&&JSON.parse(opts.body)});const body=await reply(url,opts);return {ok:!body.error,status:body.status||200,json:async()=>body};}});
 for(const file of ['booking.js','data.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);
 return {API:window.KrugData,B:window.KrugBooking,window,context,calls,storage,setReply:fn=>reply=fn};
}
test('catalog and slots use backend values and full selection parameters',async()=>{
 const {API,B,calls}=setup();assert.equal(B.priceFor(await API.getService('recording'),1),2345);
 assert.deepEqual(Array.from(await API.getAvailableSlots('2030-01-02',1,'recording')),['10:00']);
 const query=new URL(calls.at(-1).url).searchParams;assert.equal(query.get('serviceId'),'recording');assert.equal(query.get('durationHours'),'1');assert.equal(query.get('date'),'2030-01-02');
});
test('creation whitelists inputs, preserves request ID, and accepts only server financial state',async()=>{
 const {API,calls}=setup();const row=await API.createBooking({...draft(),price:1,status:'completed',paidAmount:1,paymentStatus:'paid',useBonuses:true});
 assert.equal(row.price,2500);assert.equal(row.paymentStatus,'unpaid');assert.equal(row.bonusSpent,0);assert.equal(row.bonusReserved,100);assert.equal(row.paymentMode,'on_site_only');
 const call=calls.at(-1);assert.equal(call.opts.headers['X-Telegram-Init-Data'],'signed-test-data');
 assert.deepEqual(Object.keys(call.body).sort(),['client','comment','date','durationHours','requestId','serviceId','startTime','useBonuses'].sort());assert.equal(call.body.requestId,id);
 await API.createBooking(draft());assert.equal(calls.at(-1).body.requestId,id);
 await assert.rejects(API.completePaidBooking(),/студии/);
});
test('empty local storage still loads all server bookings for Telegram identity',async()=>{
 const x=setup();const rows=await x.API.getMyBookings();assert.equal(rows.length,1);assert.equal(rows[0].id,remote.id);
 assert.equal(x.calls.length,1);assert.ok(x.calls[0].url.endsWith('/api/bookings/sync'));assert.deepEqual(x.calls[0].body,{});
});
test('tampered local payment/status is never merged or used as offline history',async()=>{
 const storage=new Map([['krug_mini_booking_cache_v2',JSON.stringify([{...remote,status:'completed',paidAmount:999999,bonusEarned:50000,priceSnapshot:{totalPrice:1},bonusSpent:50000}])]]);
 const {API,setReply}=setup({storage});const row=(await API.getMyBookings())[0];assert.equal(row.status,'request');assert.equal(row.paidAmount,undefined);assert.equal(row.bonusEarned,0);assert.equal(row.priceSnapshot,null);
 setReply(async()=>{throw Error('offline');});await assert.rejects(API.getMyBookings(),{code:'NETWORK_ERROR'});
 setReply(async()=>({ok:false,error:'TELEGRAM_AUTH_EXPIRED',status:401}));await assert.rejects(API.getMyBookings(),{code:'TELEGRAM_AUTH_EXPIRED'});
});
test('lost create response is recoverable through Telegram history even after local storage is cleared',async()=>{
 const x=setup();await x.API.getServices();x.setReply(async()=>{throw Error('response lost');});await assert.rejects(x.API.createBooking(draft()));
 const y=setup({storage:new Map()});assert.equal((await y.API.getMyBookings())[0].id,remote.id);assert.deepEqual(y.calls[0].body,{});
});
test('successful server booking survives storage quota failures',async()=>{
 const {API}=setup({failStorage:true});assert.equal((await API.createBooking(draft())).id,remote.id);assert.equal((await API.getMyBookings()).length,1);
});
test('slot conflict invalidates cached availability immediately',async()=>{
 const x=setup();await x.API.getAvailableSlots('2030-01-02',1,'recording');
 x.setReply(async url=>url.includes('/availability?')?{ok:true,availability:{closed:false,slots:[]}}:{ok:false,error:'SLOT_UNAVAILABLE',status:409});
 await assert.rejects(x.API.createBooking(draft()),{code:'SLOT_UNAVAILABLE'});assert.equal((await x.API.getAvailableSlots('2030-01-02',1,'recording')).length,0);
});
test('cancellation works after storage clear because history is server-derived',async()=>{
 const x=setup({storage:new Map()});x.setReply(async url=>url.endsWith('/sync')?{ok:true,bookings:[{...remote,price:2700}]}:{ok:true,booking:{id:remote.id,requestId:id,status:'cancelled',bonusReserved:0,amountDue:2700}});
 const row=await x.API.cancelBooking(remote.id);assert.equal(row.status,'cancelled');assert.equal(row.price,2700);assert.equal(row.bonusReserved,0);assert.deepEqual(x.calls.at(-1).body,{requestId:id});
});
test('missing Telegram initData blocks all booking history and mutation endpoints',async()=>{
 const x=setup({initData:''});await assert.rejects(x.API.getMyBookings(),{code:'TELEGRAM_AUTH_REQUIRED'});await assert.rejects(x.API.createBooking(draft()),{code:'TELEGRAM_AUTH_REQUIRED'});
 assert.ok(x.calls.every(c=>c.url.endsWith('/services')));
});
test('backend patch does not manufacture in-progress status',async()=>{
 const x=setup();x.window.KrugClient={getCurrentClient:async()=>({})};x.window.KrugAccount={statuses:{}};
 x.window.KrugData.getMyBookings=async()=>[{...remote,date:'2000-01-01'}];
 vm.runInContext(fs.readFileSync(path.join(__dirname,'..','patch-pre.js'),'utf8'),x.context);
 assert.equal((await x.API.getMyBookings())[0].status,'request');
});
