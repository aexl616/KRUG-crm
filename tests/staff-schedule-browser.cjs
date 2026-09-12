// Standalone CRM schedule dialog contract; all API writes are mocked.
const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try {
  for(const width of [390,1100]) {
   const page=await browser.newPage({viewport:{width,height:900}}),errors=[],calls=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('https://crm.test/**',async r=>{
    if(!r.request().url().endsWith('/api/crm-auth'))return r.fulfill({contentType:'text/html; charset=utf-8',body:'<html><head><meta charset="utf-8"></head><body><button data-staff-schedule="u1">График работы</button></body></html>'});
    const body=r.request().postDataJSON();calls.push(body);
    assert.equal(r.request().headers().authorization,'Bearer session-test');
    await r.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,data:{staffId:'u1',name:'AE XL',photoUrl:'',experienceSince:2018,genres:'Hip-hop',bio:'',published:true,priority:10,version:7,schedule:{weekly:{1:[{start:'12:00',end:'22:00'}]},exceptions:{}},serviceIds:['recording'],services:[{id:'recording',name:'Запись',staffSelection:'optional'}]}})});
   });
   await page.goto('https://crm.test/');
   await page.evaluate(()=>window.KrugCrmAuth={sessionToken:()=> 'session-test'});
   await page.addScriptTag({content:fs.readFileSync(path.resolve(__dirname,'../crm-staff-schedule.js'),'utf8')});
   await page.locator('[data-staff-schedule]').click();await page.locator('.staff-week').waitFor();
   assert.equal(await page.locator('[data-kind="weekly"]').count(),7);
   await page.locator('[data-day="1"] [data-add-interval]').click();
   await page.locator('[data-day="1"] [data-start]').nth(1).fill('23:00');
   await page.locator('[data-day="1"] [data-end]').nth(1).fill('02:00');
   await page.locator('[data-from]').fill('2030-01-05');await page.locator('[data-to]').fill('2030-01-07');await page.locator('[data-add-exception]').click();
   assert.equal(await page.locator('[data-kind="exceptions"]').count(),3);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   assert.equal(await page.locator('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
   if(process.argv[3]){await page.locator('dialog').evaluate(el=>el.scrollTop=0);await page.screenshot({path:path.join(process.argv[3],`staff-schedule-${width}.png`),animations:'disabled'});}
   await page.locator('[type="submit"]').click();await page.locator('dialog').waitFor({state:'detached'});
   const saved=calls.find(c=>c.action==='staffScheduleSave');assert.equal(saved.expectedVersion,7);
   assert.deepEqual(saved.profile.schedule.weekly['1'],[{start:'12:00',end:'22:00'},{start:'23:00',end:'02:00'}]);
   assert.deepEqual(saved.profile.schedule.exceptions,{'2030-01-05':[],'2030-01-06':[],'2030-01-07':[]});
   assert.deepEqual(saved.profile.serviceIds,['recording']);assert.equal(saved.profile.published,true);
   await page.locator('[data-staff-schedule]').click();await page.locator('.staff-week').waitFor();await page.keyboard.press('Escape');
   assert.equal(calls.filter(c=>c.action==='staffScheduleSave').length,1);
   assert.deepEqual(errors,[]);await page.close();console.log(`PASS CRM schedule ${width}px: weekly, overnight, leave, save, cancel`);
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
