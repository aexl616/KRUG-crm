const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function boot(saved) {
  const storage = new Map(saved ? [['studio-income-app-v1', saved]] : []);
  const listeners = {};
  const context = vm.createContext({ console, crypto: webcrypto, structuredClone, Date, setTimeout: () => 0, setInterval: () => 0,
    document: { querySelector: () => null, querySelectorAll: () => [], addEventListener: (name, cb) => { (listeners[name] ||= []).push(cb); }, hidden: false },
    window: { isSecureContext: true, addEventListener() {}, matchMedia: () => ({matches:false}) },
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, val) => storage.set(key, val) }, confirm: () => true, alert() {} });
  vm.runInContext(fs.readFileSync(path.join(root, 'app.js'), 'utf8').replace(/render\(\);\s*$/, ''), context);
  vm.runInContext('render = () => {};', context);
  vm.runInContext(fs.readFileSync(path.join(root, 'notifications.js'), 'utf8'), context);
  return { run: code => vm.runInContext(code, context), storage, context, listeners };
}
let passed = 0;
function test(name, cb) { cb(); passed++; console.log('PASS', name); }
let t = boot();
test('migration: missing notification fields and no historical spam', () => assert.equal(t.run('state.notifications.length'), 0));
t.run(`state.sessionUserId='u1'; state.payments=[]; state.bookings=[]; state.clients=[]; notificationSnapshot=notificationTakeSnapshot();
  state.bookings.push({id:'b1',client:'Тест',date:'2099-09-12',time:'18:00',duration:'1 час',service:'Запись 1 час',serviceId:'svc-recording-1',employeeId:'u2',amount:1200,status:'подтверждено'}); upsertClientFromBooking(state.bookings[0]); saveState();`);
test('booking create + derived client does not spam', () => { assert.equal(t.run("state.notifications.filter(n=>n.type==='booking_created').length"),1); assert.equal(t.run("state.notifications.filter(n=>n.entityType==='client').length"),0); });
test('multi-field save creates one booking event', () => { t.run("state.bookings[0].time='19:00';state.bookings[0].duration='2 часа';saveState();"); assert.equal(t.run("state.notifications.filter(n=>n.type==='booking_updated').length"),1); });
test('no-op saves do not create events', () => { const n=t.run('state.notifications.length');t.run('saveState();saveState();');assert.equal(t.run('state.notifications.length'),n); });
test('engineer sees own booking and redacted message', () => { t.run("state.sessionUserId='u2';"); assert.equal(t.run('notificationsForCurrentUser().length'),2); assert.ok(!t.run('notificationMessage(state.notifications[0])').includes('1200')); });
test('reassignment revokes old historical access and target', () => { t.run("state.bookings[0].employeeId='u1';"); assert.equal(t.run('notificationsForCurrentUser().length'),0); assert.equal(t.run('openNotificationTarget(state.notifications[0])'),false);t.run("state.bookings[0].employeeId='u2';"); });
test('completion creates one linked payment, no duplicate on update', () => { t.run("state.sessionUserId='u1';completeBooking('b1');saveState();state.bookings[0].amount=2400;completeBooking('b1');saveState();");assert.equal(t.run('state.payments.length'),1);assert.equal(t.run('state.payments[0].amount'),2400); });
test('engineer cannot see payment events', () => {t.run("state.sessionUserId='u2';"); assert.equal(t.run("notificationsForCurrentUser().filter(n=>n.entityType==='payment').length"),0);});
test('individual read state and mark all persist per user', () => {t.run('markAllNotificationsRead();');assert.equal(t.run('unreadNotificationsCount()'),0);t.run("state.sessionUserId='u1';");assert.ok(t.run('unreadNotificationsCount()')>0);});
test('deleting completed booking preserves payment', () => {t.run("deleteBookingSafely('b1');saveState();");assert.equal(t.run('state.payments.length'),1);});
test('catalog employee and block events', () => {t.run("state.serviceItems[0].price+=100;state.users.push({id:'u3',role:'staff',name:'Тестовый',active:true});state.studioBlocks.push({id:'bl',date:'2099-09-12',time:'12:00',duration:'1 час',title:'Уборка'});saveState();"); for(const type of ['service_updated','employee_created','studio_block_created'])assert.ok(t.run(`state.notifications.some(n=>n.type==='${type}')`));});
test('staff gets general blocks but no administrative events', () => {t.run("state.sessionUserId='u3';");assert.equal(t.run('notificationsForCurrentUser().length'),1);});
test('own payout visibility', () => {t.run("state.sessionUserId='u1';state.payouts.push({id:'p1',employeeId:'u2',employeeName:'Сотрудник',amount:300,paidAt:'2099-09-12',status:'Выплачено'});saveState();state.sessionUserId='u2';");assert.equal(t.run("notificationsForCurrentUser().filter(n=>n.entityType==='payout').length"),1);t.run("state.sessionUserId='u3';");assert.equal(t.run("notificationsForCurrentUser().filter(n=>n.entityType==='payout').length"),0);});
test('critical warnings captured once', () => {assert.ok(t.run("state.notifications.some(n=>n.severity==='critical')"));const n=t.run('state.notifications.length');t.run('saveState();');assert.equal(t.run('state.notifications.length'),n);});
t.run(`state.sessionUserId='u1';state.notifications=[];state.bookings=[{id:'rem',client:'Напоминание',date:'2099-09-12',time:'18:00',employeeId:'u2',service:'Запись',status:'подтверждено'}];state.sentReminderKeys={};notificationSnapshot=notificationTakeSnapshot();notificationNativeSave();`);
const start = t.run("new Date('2099-09-12T18:00').getTime()");
test('31 minutes: no reminder',()=>assert.equal(t.run(`checkUpcomingBookingReminders(${start-31*60000}).length`),0));
test('30 minute threshold and no duplicate',()=>{assert.equal(t.run(`checkUpcomingBookingReminders(${start-30*60000}).length`),1);assert.equal(t.run(`checkUpcomingBookingReminders(${start-29*60000}).length`),0);});
test('15 and 5 thresholds',()=>{assert.equal(t.run(`checkUpcomingBookingReminders(${start-15*60000}).length`),1);assert.equal(t.run(`checkUpcomingBookingReminders(${start-5*60000}).length`),1);});
test('reload keeps sent keys',()=>{t=boot(t.storage.get('studio-income-app-v1'));assert.equal(t.run(`checkUpcomingBookingReminders(${start-4*60000}).length`),0);});
test('past session has no stale reminders',()=>assert.equal(t.run(`checkUpcomingBookingReminders(${start+60000}).length`),0));
test('background catch-up only latest useful offset',()=>{t.run('state.sentReminderKeys={};notificationNativeSave();');assert.equal(t.run(`checkUpcomingBookingReminders(${start-12*60000}).length`),1);assert.equal(t.run('state.notifications[0].reminderOffset'),15);});
test('cancelled session never reminds',()=>{t.run("state.bookings[0].status='отменено';state.sentReminderKeys={};notificationNativeSave();");assert.equal(t.run(`checkUpcomingBookingReminders(${start-4*60000}).length`),0);});
test('reschedule resets ledger',()=>{t.run("state.bookings[0].status='подтверждено';state.bookings[0].time='20:00';saveState();");assert.equal(t.run('Object.keys(state.sentReminderKeys).length'),0);});
test('disabled offsets respected',()=>{t.run("state.bookings[0].time='18:00';state.notificationSettings.u1={offsets:{30:false,15:false,5:true}};notificationNativeSave();");assert.equal(t.run(`checkUpcomingBookingReminders(${start-12*60000}).length`),0);assert.equal(t.run(`checkUpcomingBookingReminders(${start-4*60000}).length`),1);});
test('unsupported and denied Notification API do not break in-app',()=>{assert.equal(t.run('notificationPermission()'),'unsupported');t.context.Notification={permission:'denied',requestPermission:()=>{throw Error('must not request automatically');}};t.run('deliverSystemNotification(state.notifications[0]);');assert.equal(t.run('notificationPermission()'),'denied');});
test('browser delivery only enabled and authorized',()=>{let count=0;t.context.Notification=class {static permission='granted';constructor(){count++;}close(){}};t.run("state.notificationSettings.u1={system:true};deliverSystemNotification(state.notifications[0]);");assert.equal(count,1);t.run("state.sessionUserId='u3';deliverSystemNotification(state.notifications[0]);");assert.equal(count,1);});
test('retention capped at 500',()=>{t.run("for(let i=0;i<510;i++)createNotification({type:'service_updated',entityType:'service',entityId:'s',title:'Тест',message:''});trimNotifications();");assert.equal(t.run('state.notifications.length'),500);});
test('visibilitychange invokes checker',()=>{let calls=0;t.context.probe=()=>calls++;t.run('runNotificationReminderCheck=probe;');t.listeners.visibilitychange[0]();assert.equal(calls,1);});
test('stale tab cannot overwrite newer bookings on read',()=>{const saved=JSON.parse(t.storage.get('studio-income-app-v1'));saved.bookings[0].time='22:00';t.storage.set('studio-income-app-v1',JSON.stringify(saved));t.run('persistNotificationMetadata();');assert.equal(JSON.parse(t.storage.get('studio-income-app-v1')).bookings[0].time,'22:00');assert.equal(t.run(`checkUpcomingBookingReminders(${start-60000}).length`),0);});
console.log(`${passed} tests passed`);
