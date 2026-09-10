const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const H=require('../hourly-core.js');
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS',name);}
const handlers={};
const document={querySelector:()=>null,querySelectorAll:()=>[],addEventListener(name,fn){(handlers[name]??=[]).push(fn);}};
const storage=new Map();
const ctx=vm.createContext({console,crypto:webcrypto,structuredClone,Date,document,window:{isSecureContext:true,addEventListener(){},matchMedia:()=>({matches:false})},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},setInterval(){},setTimeout(){},confirm:()=>true,alert(){}});
const run=code=>vm.runInContext(code,ctx);
for(const file of ['hourly-core.js','settings-core.js','data-store.js','app.js'])run(fs.readFileSync(require('node:path').join(__dirname,'..',file),'utf8').replace(/render\(\);\s*$/,''));
run('render=()=>{};');
for(const file of ['hourly-ui.js','finance-core.js','finance.js','notifications.js'])run(fs.readFileSync(require('node:path').join(__dirname,'..',file),'utf8'));
run("state.sessionUserId='u1';");
const grids={
 'hourly-recording':[[1200,2400,3300,4250,5200,6150,7100,8050],[1,2,3,5]],
 'hourly-morning':[[1000,1900,2800,3600,4400,5200,6000,6800],[1,3,5]],
 'hourly-recording-mix':[[1800,3600,4800,6000,7200,8400,9600,10800],[1,2,3,4,5,6]],
 'hourly-rent':[[1000,1900,2800,3600,4400,5100,5800,6500],[1,3,5,8]]
};
for(const [id,[prices,existing]] of Object.entries(grids))for(let h=1;h<=8;h++)test(`${id} ${h} hours`,()=>{const r=run(`calculateHourlyServicePrice(serviceById('${id}'),${h})`);assert.equal(r.totalPrice,prices[h-1]);assert.equal(r.source,existing.includes(h)?'existing':'derived');});
test('migration is idempotent and keeps history and unknown fields',()=>{
 const d={custom:42,serviceItems:[{id:'one',name:'Запись 1 час',price:1250,extra:'keep'},{id:'three',name:'Запись 3 часа',price:3300}],bookings:[{amount:1234,duration:3,custom:'saved'}],payments:[{amount:1234}],payouts:[{amount:100}]};
 const before=JSON.stringify(d),m=H.migrateCatalog(d);
 assert.equal(JSON.stringify(d),before);assert.deepEqual(H.migrateCatalog(m),m);assert.deepEqual(m.bookings,d.bookings);assert.deepEqual(m.payments,d.payments);assert.deepEqual(m.payouts,d.payouts);assert.equal(m.serviceItems[0].extra,'keep');assert.equal(m.serviceItems.at(-1).priceTiers[0].totalPrice,1250);
});
test('invalid legacy prices and ID collisions do not crash or duplicate',()=>{
 for(const extra of [{id:'two',name:'Запись 3 часа',price:'bad'},{id:'hourly-recording',name:'Other',price:1}]){
 const d={serviceItems:[{id:'one',name:'Запись 1 час',price:1200},{id:'three',name:'Запись 3 часа',price:3300},extra]};
 if(extra.price==='bad')d.serviceItems.splice(1,1);
 assert.equal(H.migrateCatalog(d).serviceItems.length,d.serviceItems.length);
 }
});
test('reload has exactly four hourly services and hides legacy variants',()=>{run('state=normalizeState(normalizeState(state));');assert.equal(run("catalogServices().filter(s=>s.pricingType==='hourly').length"),4);assert.equal(run("catalogServices().filter(s=>/^Запись [1235] час/.test(s.name)).length"),0);});
test('12 hour packages and singleton services remain fixed',()=>{assert.equal(run("catalogServices().find(s=>s.name==='Аренда 12 часов день').price"),9000);assert.equal(run("catalogServices().find(s=>s.name==='Аренда 12 часов ночь').price"),7500);assert.equal(run("catalogServices().filter(s=>s.name.includes('Анализ')).some(s=>s.pricingType==='hourly')"),false);});
run("var form={date:todayKey(),time:'12:00',client:'Hourly test',phone:'',telegram:'',comment:'',serviceId:'hourly-recording',duration:'4 часа',employeeId:'u1',status:'подтверждено'};");
test('new booking saves complete snapshot and full duration',()=>{run('var booking=bookingFromForm(form);state.bookings.push(booking);saveState();');assert.equal(run('booking.amount'),4250);assert.equal(run('booking.appliedTierHours'),4);assert.equal(run('booking.effectiveHourlyRate'),1062.5);assert.equal(run('booking.pricingSource'),'derived');assert.equal(run('bookingDurationMinutes(booking)'),240);});
test('catalog update does not reprice old booking or comment-only edit',()=>{run("serviceById('hourly-recording').priceTiers[3].totalPrice=9999;var edited=bookingFromForm({...form,id:booking.id,comment:'new'});");assert.equal(run('edited.amount'),4250);assert.equal(run('edited.effectiveHourlyRate'),1062.5);});
test('explicit duration edit uses current tier',()=>{assert.equal(run("bookingFromForm({...form,id:booking.id,duration:'6 часов'}).amount"),6150);assert.equal(run("bookingFromForm({...form,id:booking.id,priceRecalculate:'yes'}).amount"),9999);});
test('invalid hourly duration rejected',()=>{assert.throws(()=>run("bookingFromForm({...form,duration:'9 часов'})"));});
test('engineer cannot edit tiers',()=>{run("state.sessionUserId='u2';");assert.equal(run("saveHourlyServiceTiers('hourly-recording',{})"),false);run("state.sessionUserId='u1';");});
test('normalization preserves saved price snapshot',()=>{run('state=normalizeState(state);');assert.equal(run('state.bookings.find(b=>b.id===booking.id).amount'),4250);assert.equal(run('state.bookings.find(b=>b.id===booking.id).appliedTierHours'),4);});
test('duration preview works when a hidden id shadows form.id',()=>{
 const fields={'[name="serviceId"]':{value:'hourly-recording'},'[name="priceRecalculate"]':{value:''},'[name="amount"]':{value:0}};
 const form={id:{value:''},getAttribute:()=> 'bookingForm',querySelector:s=>fields[s]||null};
 handlers.change[0]({target:{name:'duration',value:'6 часов',form}});
 assert.equal(fields['[name="amount"]'].value,6150);assert.equal(fields['[name="priceRecalculate"]'].value,'yes');
});
test('duration and price edit emits exactly one booking event',()=>{
 const before=run("state.notifications.filter(n=>n.type==='booking_updated').length");
 run("state.bookings=state.bookings.map(b=>b.id===booking.id?bookingFromForm({...form,id:booking.id,duration:'6 часов'}):b);saveState();saveState();");
 assert.equal(run("state.notifications.filter(n=>n.type==='booking_updated').length"),before+1);
});
test('completion uses snapshot, does not duplicate payment and updates linked amount',()=>{
 run('completeBooking(booking.id);completeBooking(booking.id);saveState();');
 assert.equal(run('state.payments.filter(p=>p.bookingId===booking.id).length'),1);
 assert.equal(run('state.payments.find(p=>p.bookingId===booking.id).amount'),6150);
 run("state.payments.find(p=>p.bookingId===booking.id).custom='keep';state.bookings.find(b=>b.id===booking.id).amount=6200;completeBooking(booking.id);");
 assert.equal(run('state.payments.find(p=>p.bookingId===booking.id).amount'),6200);
 assert.equal(run('state.payments.find(p=>p.bookingId===booking.id).custom'),'keep');
 assert.equal(run("financeStats('today').revenue"),6200);
});
test('owner can edit tiers and one catalog notification is produced',()=>{
 run("var svc=serviceById('hourly-recording');var tariffData={name:svc.name,categoryId:svc.categoryId,active:'on',...Object.fromEntries(svc.priceTiers.map(t=>['tier-'+t.hours,t.totalPrice]))};tariffData['tier-4']=4300;");
 const before=run("state.notifications.filter(n=>n.type==='service_updated').length");
 assert.equal(run("saveHourlyServiceTiers('hourly-recording',tariffData)"),true);
 run('saveState();saveState();');
 assert.equal(run("state.notifications.filter(n=>n.type==='service_updated').length"),before+1);
 assert.equal(run('state.bookings.find(b=>b.id===booking.id).amount'),6200);
});
console.log(`${passed} hourly tests passed`);
