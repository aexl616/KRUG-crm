const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const window={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../booking.js'),'utf8'),{window,crypto:require('node:crypto').webcrypto,Intl,Date});
const B=window.KrugBooking;
const people=[{id:'u1',name:'AE XL'},{id:'u2',name:'Миша'}];
const availability=(staff=people,mode='optional',defaultId='u1')=>({staffSelection:mode,staffBySlot:{'10:00':{staff,defaultStaffId:defaultId}}});
const draft=()=>({...B.newDraft(),serviceId:'recording',date:'2030-01-02',startTime:'10:00',durationHours:1});
test('working specialist is selected by server recommendation; manual alternatives and any survive refresh',()=>{
 const d=draft();assert.equal(B.reconcileStaff(d,availability()).ready,true);assert.equal(d.staffId,'u1');
 B.chooseStaff(d,'u2',people);B.reconcileStaff(d,availability());assert.equal(d.staffId,'u2');
 B.chooseStaff(d,'',people);B.reconcileStaff(d,availability());assert.equal(d.staffId,null);assert.equal(d.staffChoice,'any');
 d.date='2030-01-03';B.reconcileStaff(d,availability());assert.equal(d.staffId,null);
});
test('automatic choices follow new time; unavailable manual choices require explicit replacement',()=>{
 const d=draft();B.reconcileStaff(d,availability());B.reconcileStaff(d,availability([people[1]],'optional','u2'));assert.equal(d.staffId,'u2');
 B.chooseStaff(d,'u1',people);const view=B.reconcileStaff(d,availability([people[1]]));assert.equal(view.ready,false);assert.equal(d.staffId,null);assert.match(view.message,/недоступен/);
 assert.equal(B.reconcileStaff(d,availability()).ready,false);
 B.chooseStaff(d,'',people);assert.equal(B.reconcileStaff(d,availability()).ready,true);
});
test('optional staff never blocks a free room; required staff still does',()=>{
 const d=draft();
 assert.equal(B.reconcileStaff(d,availability([],'optional',null)).ready,true);assert.equal(d.staffId,null);
 B.chooseStaff(d,'',people);assert.equal(B.reconcileStaff(d,availability(people,'required')).ready,true);assert.ok(d.staffId);
 const required=draft();assert.equal(B.reconcileStaff(required,availability([],'required',null)).ready,false);
 assert.equal(B.reconcileStaff(required,availability([],'none')).ready,true);assert.equal(required.staffId,null);
 B.changeService(required,{id:'rental',pricingType:'hourly'});assert.equal(required.staffChoice,'auto');assert.equal(required.staffId,null);
});
test('badge uses Moscow calendar date around midnight',()=>{
 assert.equal(B.staffBadge('2030-01-02',new Date('2030-01-01T21:05:00Z')),'Сегодня работает');
 assert.equal(B.staffBadge('2030-01-03',new Date('2030-01-01T21:05:00Z')),'В этот день работает');
});
