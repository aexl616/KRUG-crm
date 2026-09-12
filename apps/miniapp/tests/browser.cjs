// Offline browser contract test; never creates a production booking.
const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const base=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.resolve(base,'.'+(req.url==='/'?'/index.html':req.url.split('?')[0]));if(!file.startsWith(base+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(data);});});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({headless:true,channel:'msedge'});
  for(const width of [390,900]){
   const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),page=await context.newPage();
   const errors=[],calls=[];let booking=null,failSync=false;
   page.on('pageerror',e=>errors.push(e.message));
   await context.addInitScript(()=>{localStorage.setItem('krug_mini_client_v1',JSON.stringify({onboarded:true,backendSynced:true,name:'Анна',phone:'+7 999 123-45-67',telegramUserId:123}));window.Telegram={WebApp:{initData:'test-signed-data',initDataUnsafe:{user:{id:123,first_name:'Анна'}}}};});
   await page.route('https://telegram.org/**',r=>r.fulfill({contentType:'text/javascript',body:''}));
   await page.route('https://krug-crm.vercel.app/api/**',async r=>{
    const req=r.request(),url=new URL(req.url()),body=req.postDataJSON();calls.push({path:url.pathname,body,headers:req.headers()});
    let result={ok:true};let status=200;
    if(url.pathname==='/api/services')result.services=[{id:'recording',name:'Запись',publicName:'Запись',publicVisible:true,publicCategory:'primary',active:true,pricingType:'hourly',priceTiers:[{durationHours:1,totalPrice:2345}],pricingRules:{hourlyRate:2345}}];
    else if(url.pathname==='/api/availability')result.availability={date:url.searchParams.get('date'),closed:false,slots:['10:00','12:00'],staffSelection:'optional',staffBySlot:{'10:00':{defaultStaffId:'u1',staff:[{id:'u1',name:'AE XL',scheduled:true,experienceSince:2018,genres:'Hip-hop · Pop',bio:'Запись вокала и сведение'},{id:'u2',name:'Миша',scheduled:true,genres:'Rock'}]},'12:00':{defaultStaffId:'u2',staff:[{id:'u2',name:'Миша',scheduled:true}]}}};
    else if(url.pathname==='/api/loyalty')result.loyalty={balance:0,enabled:true,accrualPercent:7,history:[]};
    else if(url.pathname==='/api/bookings'){booking={id:'server-booking',requestId:body.requestId,serviceId:body.serviceId,serviceName:'Запись',staffId:body.staffId||'u1',staffName:body.staffId==='u2'?'Миша':'AE XL',date:body.date,startTime:body.startTime,durationHours:body.durationHours,price:2500,amountDue:2500,status:'request',paymentStatus:'unpaid',createdAt:new Date().toISOString()};result.booking=booking;}
    else if(url.pathname==='/api/bookings/sync'){if(failSync){result={ok:false,error:'TELEGRAM_AUTH_EXPIRED',message:'Открой Mini App заново'};status=401;}else result.bookings=booking?[booking]:[];}
    else if(url.pathname==='/api/bookings/cancel'){booking={...booking,status:'cancelled',bonusReserved:0};result.booking={id:booking.id,requestId:booking.requestId,status:'cancelled',bonusReserved:0,amountDue:2500};}
    else throw Error('Unexpected API '+url.pathname);
    await r.fulfill({status,contentType:'application/json',body:JSON.stringify(result)});
   });
   await page.goto('http://127.0.0.1:'+server.address().port+'/');
   await page.locator('[data-service-quick="recording"]').waitFor();
   assert.match(await page.locator('.service-copy b').innerText(),/2\s345/);
   assert.equal(await page.locator('[data-service-quick="rental"]').count(),0);
   await page.locator('[data-service-quick="recording"]').click();
   await page.locator('[data-duration="1"]').click();await page.locator('[data-action="next"]').click();
   await page.locator('[data-date]:not([disabled])').nth(1).click();await page.locator('[data-action="next"]').click();
   await page.locator('[data-time="10:00"]').click();
   assert.equal(await page.locator('[data-staff="u1"]').getAttribute('aria-pressed'),'true');
   assert.match(await page.locator('[data-staff="u1"]').innerText(),/В этот день работает/);
   await page.locator('[data-staff="u1"]').click();await page.locator('[data-time="12:00"]').click();
   assert.equal(await page.locator('[data-action="next"]').isDisabled(),true);
   await page.locator('[data-staff="u2"]').click();await page.locator('[data-action="next"]').click();
   await page.getByRole('heading',{name:'Всё верно?'}).waitFor();
   assert.equal(await page.locator('[data-staff="u2"]').getAttribute('aria-pressed'),'true');
   await page.locator('[data-staff=""]').click();
   await page.locator('[data-staff=""][aria-pressed="true"]').waitFor();
   assert.equal(await page.locator('[data-staff=""]').getAttribute('aria-pressed'),'true');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   if(process.argv[3]){await page.locator('.staff-selection').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(process.argv[3],`staff-selection-${width}.png`),fullPage:true,animations:'disabled'});}
   assert.match(await page.locator('.summary').innerText(),/Оплата на студии/);
   await page.locator('[form="booking-form"]').click();await page.locator('[data-action="success-bookings"]').waitFor();
   assert.match(await page.locator('.summary-total').innerText(),/2\s500/);
   const create=calls.find(c=>c.path==='/api/bookings');assert.equal(create.body.staffId,null);assert.equal(create.headers['x-telegram-init-data'],'test-signed-data');assert.equal(create.body.paymentStatus,undefined);assert.equal(create.body.price,undefined);
   await page.locator('[data-action="success-bookings"]').click();await page.locator('[data-cancel]').click();await page.locator('.krug-confirm [value="confirm"]').click();
   await page.waitForFunction(()=>document.querySelector('#tab-history')?.textContent.includes('1'));
   await page.locator('[data-action="list-history"]').click();assert.match(await page.locator('.booking-card').innerText(),/Отменено/);
   failSync=true;await page.locator('[data-action="list-upcoming"]').click();await page.getByRole('heading',{name:'Не удалось загрузить данные'}).waitFor();assert.equal(await page.locator('.booking-card').count(),0);
   failSync=false;await page.locator('[data-action="retry"]').click();await page.locator('#tab-history').waitFor();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   if(process.argv[3])await page.screenshot({path:path.join(process.argv[3],`miniapp-090-${width}.png`),fullPage:true});
   assert.deepEqual(errors,[]);await context.close();console.log('PASS browser booking → server price → sync → cancellation → history → auth error/retry at '+width+'px');
  }
 }finally{await browser?.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
