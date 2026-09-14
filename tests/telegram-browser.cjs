// Shipped management UI with mocked API writes: this test sends no real messages.
const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const content=require('../telegram-content'),dir=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CI?{}:{channel:'msedge'})});
 try{
  for(const width of [390,1100]){
   const page=await browser.newPage({viewport:{width,height:900}}),errors=[],calls=[];
   const t={kind:'welcome',version:1,title:'Добро пожаловать',body:'Привет, {client_name}',button_text:'Открыть КРУГ',button_target:'miniapp',button_url:''};
   const data={tags:['VIP'],templates:[t,{...t,kind:'campaign',title:'Новости'}],pending:4,sent:2,failed:1,last_run_at:new Date().toISOString(),last_update_at:new Date().toISOString(),
    health:{connected:true,username:'krug_test',webhook_matches:true},
    errors:[{id:'e1',kind:'confirmed',status:'failed',last_error:'DELIVERY_UNCERTAIN',attempts:1,created_at:new Date().toISOString()}],
    campaigns:[],clients:[{id:'c1',name:'<img src=x onerror="window.injected=true">',telegram_user_id:100,telegram_started_at:new Date().toISOString(),marketing_enabled:true,reminders_enabled:true}]};
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('https://crm.test/**',async route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/')return route.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><html><head><meta charset="utf-8"></head><body style="background:#101012;color:#eee;font-family:Arial"><div id="app"><nav class="nav"></nav></div></body></html>'});
    if(url.pathname!=='/api/telegram/admin')return route.fulfill({status:404});
    assert.equal(route.request().headers().authorization,'Bearer browser-session');
    const b=route.request().postDataJSON();calls.push(b);let result;
    if(b.action==='overview')result=data;
    else if(b.action==='preview'){
     try{result=content.render(b.content);}catch(e){return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({ok:false,message:e.message})});}
    }else if(b.action==='saveTemplate'){Object.assign(t,b.content,{version:t.version+1});result=t;}
    else if(b.action==='previewAudience')result={count:2};
    else if(b.action==='saveCampaign'){
     const c={id:'campaign1',...b.content,message:b.content.body,audience:b.audience,status:'draft',queued_count:0,sent_count:0,failed_count:0,skipped_count:0};data.campaigns.unshift(c);result=c;
    }else if(b.action==='launchCampaign'){Object.assign(data.campaigns[0],{status:'scheduled',queued_count:2,scheduled_at:b.scheduled_at});result=data.campaigns[0];}
    else if(b.action==='retry')result={retried:1};else if(b.action==='testSend')result={queued:true};else throw Error('Unexpected action '+b.action);
    await route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,data:result})});
   });
   await page.goto('https://crm.test/');
   await page.evaluate(()=>{window.KrugCrmAuth={sessionToken:()=> 'browser-session'};sessionStorage.setItem('krug-crm-session-user-v1',JSON.stringify({role:'owner'}));});
   for(const file of ['app-management.css','telegram-management.css'])await page.addStyleTag({content:fs.readFileSync(path.join(dir,file),'utf8')});
   for(const file of ['telegram-content.js','telegram-notifications-management.js'])await page.addScriptTag({content:fs.readFileSync(path.join(dir,file),'utf8')});
   await page.locator('[data-tg-open]').click();await page.locator('[data-refresh]').waitFor();
   if(process.argv[3])await page.screenshot({path:path.join(process.argv[3],`telegram-overview-${width}.png`),animations:'disabled'});
   assert.ok((await page.locator('.tg-dialog').innerText()).includes('Автоматическая доставка: работает'));
   page.once('dialog',d=>d.dismiss());await page.locator('[data-retry]').click();assert.equal(calls.filter(c=>c.action==='retry').length,0);
   page.once('dialog',d=>d.accept());await page.locator('[data-retry]').click();await page.getByText('Повторно в очереди: 1.').waitFor();
   assert.equal(calls.find(c=>c.action==='retry').acknowledge_uncertain,true);
   await page.locator('[data-tab="templates"]').click();await page.locator('[name="body"]').fill('Привет, {secret}');await page.locator('[data-preview]').click();await page.getByText('Неизвестная переменная или незакрытая скобка.').waitFor();
   await page.locator('[name="body"]').fill('Привет, {client_name}! До встречи.');await page.locator('[data-preview]').click();await page.locator('[data-preview-output]').filter({hasText:'Привет, Анна!'}).waitFor();
   await page.locator('[type="submit"]').click();await page.getByText('Шаблон сохранён.').waitFor();assert.equal(calls.find(c=>c.action==='saveTemplate').version,1);
   await page.locator('[data-tab="campaigns"]').click();await page.locator('[data-source]').selectOption('campaign');
   await page.locator('[name="tag"]').selectOption('VIP');
   await page.locator('[name="segment"]').selectOption('visited');await page.locator('[data-preview]').click();await page.getByText('Получателей сейчас: 2',{exact:false}).waitFor();
   const scheduled='2030-01-02T18:00';await page.locator('[name="scheduled_at"]').fill(scheduled);await page.locator('[type="submit"]').click();await page.locator('[data-launch]').waitFor();
   assert.equal(calls.find(c=>c.action==='saveCampaign').audience.segment,'visited');assert.equal(await page.locator('[data-schedule]').inputValue(),scheduled);
   assert.equal(calls.find(c=>c.action==='saveCampaign').audience.tag,'VIP');
   if(process.argv[3])await page.screenshot({path:path.join(process.argv[3],`telegram-campaign-${width}.png`),animations:'disabled'});
   page.once('dialog',d=>d.accept());await page.locator('[data-launch]').click();await page.getByText('Рассылка запущена. Доставку выполняет автоматическая очередь.').waitFor();
   assert.ok(calls.find(c=>c.action==='launchCampaign').scheduled_at.endsWith('Z'));assert.ok((await page.locator('.tg-dialog').innerText()).includes('Запланирована'));
   await page.locator('[data-tab="clients"]').click();assert.equal(await page.locator('.tg-dialog img').count(),0);assert.equal(await page.evaluate(()=>window.injected),undefined);
   await page.locator('[data-test]').click();await page.getByText('Тестовое сообщение добавлено в очередь.').waitFor();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   assert.equal(await page.locator('.tg-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
   await page.keyboard.press('Escape');await page.locator('.tg-dialog').waitFor({state:'detached'});
   await page.evaluate(()=>{sessionStorage.setItem('krug-crm-session-user-v1',JSON.stringify({role:'engineer'}));document.querySelector('#app').append(document.createElement('span'));});
   await page.locator('[data-tg-open]').waitFor({state:'detached'});assert.deepEqual(errors,[]);
   await page.close();console.log(`PASS Telegram ${width}px: health, templates, campaign preview/schedule, retry, test-send, XSS, role gate`);
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
