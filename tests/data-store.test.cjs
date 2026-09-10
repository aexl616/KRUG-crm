const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {webcrypto} = require('node:crypto');
const {DataStore, LocalStorageAdapter, STORAGE_KEY} = require('../data-store.js');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS', name); }
function fixture(initial) {
  let raw = initial === undefined ? null : JSON.stringify(initial);
  let failRead = false, failWrite = false;
  const errors = [];
  const storage = {getItem(key) { assert.equal(key, STORAGE_KEY); if (failRead) throw Error('denied'); return raw; }, setItem(key,value) { assert.equal(key, STORAGE_KEY); if (failWrite) throw Error('quota'); raw = value; }};
  const store = new DataStore({adapter:new LocalStorageAdapter(()=>storage), defaults:()=>({bookings:[],settings:{}}), normalize:data=>({...data, migrated:true}), onError:error=>errors.push(error)});
  return {store, errors, get raw(){return raw;}, set raw(value){raw=value;}, failRead(value){failRead=value;}, failWrite(value){failWrite=value;}};
}
test('existing state loads with unknown fields and does not rewrite storage',()=>{
  const t=fixture({bookings:[{id:'b',extra:{keep:1}}],custom:{future:true}}),before=t.raw;
  assert.deepEqual(t.store.loadState().custom,{future:true});assert.equal(t.raw,before);
});
test('save and load return detached data',()=>{
  const t=fixture(),value={bookings:[{id:'b',amount:100}]};t.store.loadState();assert.equal(t.store.saveState(value),true);
  value.bookings[0].amount=999;const loaded=t.store.loadState();loaded.bookings[0].amount=50;
  assert.equal(t.store.loadState().bookings[0].amount,100);
});
test('broken JSON fallback cannot overwrite original',()=>{
  const t=fixture();t.raw='{broken';const fallback=t.store.loadState();assert.deepEqual(fallback.bookings,[]);
  assert.equal(t.store.saveState(fallback),false);assert.equal(t.raw,'{broken');assert.ok(t.errors.length);
});
test('invalid root JSON has safe fallback',()=>{
  for(const raw of ['null','[]','42','"text"']) {const t=fixture();t.raw=raw;assert.deepEqual(t.store.loadState().bookings,[]);assert.equal(t.store.saveState({}),false);assert.equal(t.raw,raw);}
});
test('read access error uses defaults without deleting storage',()=>{
  const t=fixture({custom:1}),before=t.raw;t.failRead(true);assert.deepEqual(t.store.loadState().bookings,[]);assert.equal(t.store.saveState({}),false);assert.equal(t.raw,before);
});
test('failed write leaves previous data and input intact',()=>{
  const t=fixture({bookings:[{id:'old'}]});t.store.loadState();const before=t.raw,value={bookings:[{id:'new'}]};t.failWrite(true);
  assert.equal(t.store.saveState(value),false);assert.equal(t.raw,before);assert.deepEqual(value,{bookings:[{id:'new'}]});
  t.failWrite(false);assert.equal(t.store.saveState(value),true);
});
test('undefined is not persisted and earlier unknown root survives',()=>{
  const t=fixture({custom:{keep:1}});t.store.loadState();assert.equal(t.store.saveState({custom:undefined,bookings:[],optional:undefined}),true);
  assert.deepEqual(JSON.parse(t.raw).custom,{keep:1});assert.equal(Object.hasOwn(JSON.parse(t.raw),'optional'),false);
});
test('invalid or unserializable writes are rejected atomically',()=>{
  const t=fixture({bookings:[]});t.store.loadState();const before=t.raw,cyclic={};cyclic.self=cyclic;
  for(const value of [undefined,null,[],{a:1n},{a:Infinity},{a:NaN},{a:()=>{}},{a:Symbol('x')},{a:new Map()},cyclic,{a:[undefined]}]) {
    assert.equal(t.store.saveState(value),false);assert.equal(t.raw,before);
  }
});
test('migration exception preserves original and blocks startup writes',()=>{
  const t=fixture({bad:true});t.store.addNormalizer(data=>{if(data.bad)throw Error('invalid legacy');return data;});const before=t.raw;
  assert.equal(t.store.loadState().bad,undefined);assert.equal(t.store.saveState({}),false);assert.equal(t.raw,before);
});
test('entity create update delete preserve unrelated data',()=>{
  const t=fixture({custom:9,bookings:[]});const entity={id:'b',extra:{keep:true}};
  assert.equal(t.store.createEntity('bookings',entity),true);assert.equal(t.store.updateEntity('bookings','b',{amount:100}),true);
  assert.deepEqual(t.store.getCollection('bookings'),[{...entity,amount:100}]);assert.deepEqual(entity,{id:'b',extra:{keep:true}});
  assert.equal(t.store.deleteEntity('bookings','b'),true);assert.deepEqual(t.store.getCollection('bookings'),[]);assert.equal(JSON.parse(t.raw).custom,9);
});
test('duplicate id missing id and identity change do not write',()=>{
  const t=fixture({bookings:[{id:'b'}]}),before=t.raw;
  assert.equal(t.store.createEntity('bookings',{id:'b'}),false);assert.equal(t.store.createEntity('bookings',{}),false);
  assert.equal(t.store.updateEntity('bookings','b',{id:'other'}),false);assert.equal(t.store.deleteEntity('bookings','absent'),false);assert.equal(t.raw,before);
});
test('object settings and new collection types are supported',()=>{
  const t=fixture();assert.equal(t.store.setCollection('financePlan',{monthlyRevenueTarget:1000}),true);
  assert.equal(t.store.setCollection('serviceTypes',[{id:'type'}]),true);assert.equal(t.store.setCollection('notificationSettings',{u1:{system:false}}),true);
  assert.equal(t.store.getCollection('financePlan').monthlyRevenueTarget,1000);
});
test('normalizers work on copies',()=>{
  const original={bookings:[{id:'b'}]};const t=fixture(original);t.store.addNormalizer(data=>{data.bookings[0].added=true;return data;});
  const input={bookings:[{id:'b'}]};t.store.normalize(input);assert.deepEqual(input,original);assert.equal(JSON.parse(t.raw).bookings[0].added,undefined);
});
test('multi-tab reload reads newest snapshot and never writes',()=>{
  const t=fixture({bookings:[{id:'old'}]});const current=t.store.loadState();t.raw=JSON.stringify({bookings:[{id:'new'}],custom:7});const before=t.raw;
  assert.equal(t.store.reloadState(current).bookings[0].id,'new');assert.equal(current.bookings[0].id,'old');assert.equal(t.raw,before);
  t.raw='broken';assert.equal(t.store.reloadState(current),current);
});
test('successful reread permits recovery after read error',()=>{
  const t=fixture();t.raw='broken';t.store.loadState();t.raw='{"bookings":[]}';t.store.loadState();assert.equal(t.store.saveState({bookings:[{id:'ok'}]}),true);
});
test('adapter can be replaced without business storage calls',()=>{
  let serialized=null;const adapter={read:()=>serialized,write:value=>{serialized=value;}};
  const store=new DataStore({adapter});store.loadState();assert.equal(store.saveState({hello:'world'}),true);assert.equal(store.loadState().hello,'world');
});

// Real legacy migrations + Finance + Notifications, with no DOM rendering or network.
const root=path.resolve(__dirname,'..');
function boot(raw) {
  const storage=new Map(raw===undefined?[]:[[STORAGE_KEY,raw]]),errors=[];
  const context=vm.createContext({console:{log(){},error:message=>errors.push(message)},crypto:webcrypto,structuredClone,Date,setTimeout(){},setInterval(){},
    document:{querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}},window:{isSecureContext:true,addEventListener(){},matchMedia:()=>({matches:false})},
    localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)},confirm:()=>true,alert(){}});
  const run=code=>vm.runInContext(code,context);
  for(const f of ['hourly-core.js','settings-core.js'])run(fs.readFileSync(path.join(root,f),'utf8'));
  run(fs.readFileSync(path.join(root,'data-store.js'),'utf8'));
  run(fs.readFileSync(path.join(root,'app.js'),'utf8').replace(/render\(\);\s*$/,''));run('render=()=>{};');
  for(const file of ['finance-core.js','finance.js','notifications.js'])run(fs.readFileSync(path.join(root,file),'utf8'));
  return {storage,run,errors};
}
test('real old state migration preserves nested unknown fields',()=>{
  const t=boot(JSON.stringify({sessionUserId:'u1',users:[{id:'u1',name:'AE XL',role:'owner',custom:7}],serviceGroups:[{id:'recording',name:'Запись',custom:8}],serviceItems:[{id:'svc',name:'Запись 1 час',categoryId:'recording',price:100,custom:9}],clients:[{id:'c',name:'Тест',custom:10}],bookings:[{id:'b',client:'Тест',serviceId:'svc',service:'Запись 1 час',amount:100,status:'завершено',employeeId:'u1'}],payments:[],access:{future:11},calendarSettings:{future:12},future:{keep:true}}));
  const saved=JSON.parse(t.storage.get(STORAGE_KEY));
  assert.equal(saved.users[0].custom,7);assert.equal(saved.serviceGroups[0].custom,8);assert.equal(saved.serviceItems[0].custom,9);assert.equal(saved.clients[0].custom,10);
  assert.equal(saved.access.future,11);assert.equal(saved.calendarSettings.future,12);assert.deepEqual(saved.future,{keep:true});assert.ok(saved.bookings[0].clientId);
});
test('Finance and Notifications data survive full application reload',()=>{
  const t=boot();t.run("state.sessionUserId='u1';saveExpense({date:todayKey(),title:'Сохранение 1.1',category:'Реклама',amount:150,recurring:true});saveFinancePlan({monthlyRevenueTarget:2000,monthlyExpenseLimit:1000});state.notificationSettings.u1={inApp:true,system:false,offsets:{30:true,15:true,5:false}};state.sentReminderKeys.keep={bookingId:'future',start:4102444800000,userId:'u1'};notificationNativeSave();");
  const saved=JSON.parse(t.storage.get(STORAGE_KEY));const reload=boot(t.storage.get(STORAGE_KEY));const after=JSON.parse(reload.storage.get(STORAGE_KEY));
  for(const key of ['expenses','financePlan','notifications','notificationSettings','sentReminderKeys'])assert.deepEqual(after[key],saved[key]);
  assert.equal(reload.run('financeStats().expenses'),150);assert.equal(reload.run('state.sessionUserId'),'u1');
});
test('real startup broken JSON fallback never overwrites corrupt payload',()=>{
  const t=boot('{broken');assert.equal(t.storage.get(STORAGE_KEY),'{broken');assert.ok(t.errors.length);assert.ok(t.run('dataStorageNotice.length')>0);
});
test('real stale notification write preserves newer business state',()=>{
  const t=boot();const fresh=JSON.parse(t.storage.get(STORAGE_KEY));fresh.expenses=[{id:'new',date:'2026-09-08',amount:700,title:'Другой экран'}];fresh.futureField={keep:1};
  t.storage.set(STORAGE_KEY,JSON.stringify(fresh));t.run('persistNotificationMetadata();');const saved=JSON.parse(t.storage.get(STORAGE_KEY));assert.deepEqual(saved.expenses,fresh.expenses);assert.deepEqual(saved.futureField,fresh.futureField);
});
test('business save handles temporarily invalid state without erasing storage',()=>{
  const t=boot(),before=t.storage.get(STORAGE_KEY);t.run('state.notifications=null;');assert.equal(t.run('saveState()'),false);assert.equal(t.storage.get(STORAGE_KEY),before);assert.ok(t.errors.length);
});
test('expense failed write rolls back and retry creates only one expense',()=>{const t=boot();t.run("state.sessionUserId='u1';var nativeWrite=dataStore.adapter.write.bind(dataStore.adapter);dataStore.adapter.write=()=>{throw Error('quota')};var countBefore=state.expenses.length;var result=saveExpense({date:todayKey(),title:'Retry',category:'Прочее',amount:123});");assert.equal(t.run('result.ok'),false);assert.equal(t.run('state.expenses.length===countBefore'),true);t.run("dataStore.adapter.write=nativeWrite;saveExpense({date:todayKey(),title:'Retry',category:'Прочее',amount:123});");assert.equal(t.run('state.expenses.length===countBefore+1'),true);});
test('hourly and settings snapshots survive data layer reload',()=>{const t=boot();t.run("state.settings.general.studioName='Проверка';state.bookings.push({id:'hourly-preserve',date:todayKey(),time:'12:00',client:'Клиент',employeeId:'u1',status:'завершено',service:'Запись',serviceName:'Запись',amount:4250,duration:'4 часа',pricingType:'hourly',appliedTierHours:4,effectiveHourlyRate:1062.5});saveState();");const before=JSON.parse(t.storage.get(STORAGE_KEY)),after=JSON.parse(boot(t.storage.get(STORAGE_KEY)).storage.get(STORAGE_KEY));for(const [key,value] of Object.entries(before.bookings.find(b=>b.id==='hourly-preserve')))assert.deepEqual(after.bookings.find(b=>b.id==='hourly-preserve')[key],value);assert.deepEqual(after.settings,before.settings);});
test('metadata reads cannot bypass migration write protection',()=>{const t=fixture({bad:true});t.store.addNormalizer(data=>{if(data.bad)throw Error('invalid');return data;});t.store.loadState();const before=t.raw;assert.equal(t.store.saveState({}),false);t.store.readState();assert.equal(t.store.saveState({bookings:[]}),false);assert.equal(t.raw,before);});
console.log(`${passed} data layer tests passed`);
