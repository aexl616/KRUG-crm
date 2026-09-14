const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
test('0.12.0 SQL: lifecycle, consent, campaigns, leases, RBAC and idempotency',async()=>{
 const db=new PGlite();
 const q=async(sql,args=[])=>(await db.query(sql,args)).rows;
 const v=async(sql,args=[])=>Object.values((await q(sql,args))[0])[0];
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema extensions;
   create function extensions.gen_salt(text,integer) returns text language sql as $$select 'fixture'::text$$;
   create function extensions.crypt(text,text) returns text language sql as $$select 'fixture-password'::text$$;
   create function extensions.digest(text,text) returns bytea language sql as $$select decode(md5($1),'hex')$$;`);
  const directory=path.resolve(__dirname,'../migrations');
  for(const file of fs.readdirSync(directory).filter(f=>f.endsWith('.sql')).sort()){
   try{await db.exec(fs.readFileSync(path.join(directory,file),'utf8').replace('create extension if not exists pgcrypto;',''));}
   catch(e){throw Error(file+': '+e.message,{cause:e});}
  }
  await db.exec('update crm_staff_users set active=true,must_change_password=false');
  const owner=await v("insert into crm_staff_sessions(user_id) values('u1') returning token");
  const engineer=await v("insert into crm_staff_sessions(user_id) values('u2') returning token");
  const admin=(action,payload={},session=owner)=>v('select krug_telegram_admin($1,$2,$3)',[session,action,JSON.stringify(payload)]);
  const update=(id,user,command,blocked=null)=>v('select krug_telegram_update($1,$2,$3,$4,$5,$6)',[id,user,'Анна','anna',command,blocked]);
  const prefs=(user,changes=null)=>v('select krug_telegram_preferences($1,$2)',[user,changes&&JSON.stringify(changes)]);
  const count=(where,args=[])=>v('select count(*)::int from telegram_notifications where '+where,args);
  const valid={title:'КРУГ',body:'Привет, {client_name}',button_text:'Открыть',button_target:'miniapp',button_url:''};
  for(const action of ['overview','saveTemplate','launchCampaign','testSend','retry','previewAudience','saveCampaign'])await assert.rejects(admin(action,{},engineer),/CRM_FORBIDDEN/);
  await assert.rejects(admin('overview',{},'00000000-0000-4000-8000-000000000000'),/CRM_SESSION_INVALID/);
  assert.equal((await update(1,101,'/start')).kind,'welcome');
  assert.equal((await update(1,101,'/start')).duplicate,true);
  assert.equal((await update(2,101,'/start')).kind,'start_repeat');
  assert.equal(await count("kind='welcome'"),1);
  assert.equal((await prefs(101)).marketing_enabled,false);
  assert.equal((await prefs(101)).transactional_required,true);
  await assert.rejects(prefs(101,{service_enabled:false}),/PREFERENCES_INVALID/);
  await update(3,101,'/marketing_on');assert.equal((await prefs(101)).marketing_enabled,true);
  const cid=await v('select id from clients where telegram_user_id=101');
  const preview=await admin('previewAudience',{audience:{segment:'all'}});assert.equal(preview.count,1);
  assert.equal((await admin('previewAudience',{audience:{segment:'miniapp'}})).count,0);
  await q('update clients set registered_in_app=true where id=$1',[cid]);
  assert.equal((await admin('previewAudience',{audience:{segment:'miniapp'}})).count,1);
  await q("update crm_shared_state set data=jsonb_set(data,'{clients}',$1::jsonb)",[JSON.stringify([{id:'crm-1',miniAppClientId:cid,tags:['VIP','Вокал']},{id:'unlinked',name:'Анна',telegramUserId:101,tags:['Unlinked']}])]);
  assert.equal((await admin('previewAudience',{audience:{segment:'all',tag:'VIP'}})).count,1);
  assert.equal((await admin('previewAudience',{audience:{segment:'all',tag:'Unlinked'}})).count,0);
  assert.deepEqual((await admin('overview')).tags,['VIP','Вокал']);
  await assert.rejects(admin('previewAudience',{audience:{segment:'all',tags:['x']}}),/AUDIENCE_INVALID/);
  await assert.rejects(admin('saveTemplate',{kind:'welcome',version:1,content:{...valid,body:'{secret}'}}),/PLACEHOLDER_INVALID/);
  await assert.rejects(admin('saveTemplate',{kind:'welcome',version:1,content:{...valid,body:'hello {'}}),/PLACEHOLDER_INVALID/);
  await assert.rejects(admin('saveTemplate',{kind:'welcome',version:1,content:{...valid,button_target:'url',button_url:'javascript:alert(1)'}}),/BUTTON_INVALID/);
  const template=await admin('saveTemplate',{kind:'welcome',version:1,content:valid});assert.equal(template.version,2);
  await assert.rejects(admin('saveTemplate',{kind:'welcome',version:1,content:valid}),/CONFLICT/);
  // Receipt + state changes + repeat status changes; no notification for irrelevant writes.
  const bid=await v(`insert into bookings(client_id,service_id,service_name_snapshot,starts_at,ends_at,price_rub)
    values($1,'recording','Запись',now()+interval '3 days',now()+interval '3 days 2 hours',4000) returning id`,[cid]);
  assert.equal(await count("booking_id=$1 and kind='created'",[bid]),1);
  await q("update bookings set status='confirmed' where id=$1",[bid]);
  assert.equal(await count("booking_id=$1 and kind='confirmed'",[bid]),1);
  assert.equal(await count("booking_id=$1 and kind like 'reminder_%' and status='pending'",[bid]),3);
  const eligible=kind=>v('select private.krug_tg_eligible(n) from telegram_notifications n where booking_id=$1 and kind=$2 and status=\'pending\' limit 1',[bid,kind]);
  assert.equal(await eligible('reminder_24h'),true);assert.equal(await eligible('reminder_30m'),false);
  await prefs(101,{reminder_30m_enabled:true});assert.equal(await eligible('reminder_30m'),true);
  await prefs(101,{reminders_enabled:false});assert.equal(await eligible('reminder_24h'),false);assert.equal(await eligible('confirmed'),true);
  await prefs(101,{reminders_enabled:true});
  await q("update bookings set comment='новый комментарий' where id=$1",[bid]);
  assert.equal(await count("booking_id=$1 and kind='changed'",[bid]),0);
  await q("update bookings set starts_at=starts_at+interval '1 hour',ends_at=ends_at+interval '1 hour' where id=$1",[bid]);
  assert.equal(await count("booking_id=$1 and kind='changed'",[bid]),1);
  assert.equal(await count("booking_id=$1 and kind like 'reminder_%' and status='pending'",[bid]),3);
  assert.equal(await count("booking_id=$1 and kind like 'reminder_%' and status='skipped'",[bid]),3);
  await q("update bookings set status='cancelled' where id=$1",[bid]);
  assert.equal(await count("booking_id=$1 and kind='cancelled_studio'",[bid]),1);
  assert.equal(await count("booking_id=$1 and kind like 'reminder_%' and status='pending'",[bid]),0);
  const other=await v(`insert into bookings(client_id,service_id,service_name_snapshot,starts_at,ends_at,price_rub)
    values($1,'recording','Запись',now()+interval '4 days',now()+interval '4 days 2 hours',4000) returning request_id`,[cid]);
  await assert.rejects(v('select krug_telegram_client_cancel($1,999)',[other]),/BOOKING_NOT_FOUND/);
  await v('select krug_telegram_client_cancel($1,101)',[other]);
  await v('select krug_telegram_client_cancel($1,101)',[other]);
  assert.equal(await count("kind='cancelled_client'"),1);
  await q("update bookings set status='completed' where id=$1",[bid]);
  assert.equal(await count("kind='completed'"),1);
  await q("insert into loyalty_transactions(client_id,booking_id,amount_points,kind,reason) values($1,$2,200,'booking_accrual','test')",[cid,bid]);
  assert.equal(await count("kind='loyalty_accrual' and context->>'bonuses'='200'"),1);
  const reserve=await v(`insert into loyalty_reservations(client_id,booking_id,points,rubles_per_point) values($1,$2,100,1) returning id`,[cid,bid]);
  await q("update loyalty_reservations set status='refunded' where id=$1",[reserve]);
  assert.equal(await count("kind='loyalty_refund' and context->>'bonuses'='100'"),1);
  assert.equal((await admin('previewAudience',{audience:{segment:'visited'}})).count,1);
  // Queue claim: disjoint leases; invalid lease cannot ack; mandatory events ignore legacy service flag.
  await q('update notification_preferences set service_enabled=false,reminders_enabled=false where client_id=$1',[cid]);
  const first=await q('select * from krug_telegram_claim(2)'),second=await q('select * from krug_telegram_claim(2)');
  assert.equal(first.length,2);assert.equal(second.length,2);assert.ok(first.every(a=>second.every(b=>a.id!==b.id)));
  assert.equal(await v("select krug_telegram_finish($1,gen_random_uuid(),'sent')",[first[0].id]),false);
  assert.equal(await v('select krug_telegram_delivery_check($1,$2)',[first[0].id,first[0].lease_token]),true);
  await v("select krug_telegram_finish($1,$2,'sent',null,60,42)",[first[0].id,first[0].lease_token]);
  assert.equal(await v('select telegram_message_id::int from telegram_notifications where id=$1',[first[0].id]),42);
  await q("update telegram_notifications set lease_until=now()-interval '1 second' where id=$1",[first[1].id]);
  await q('select * from krug_telegram_claim(1)');
  assert.equal(await v('select last_error from telegram_notifications where id=$1',[first[1].id]),'DELIVERY_UNCERTAIN');
  assert.equal((await admin('retry',{id:first[1].id})).retried,0);
  assert.equal((await admin('retry',{id:first[1].id,acknowledge_uncertain:true})).retried,1);
  // Only opted-in/unblocked recipients, snapshot membership, current consent at delivery, idempotent launch.
  await update(10,102,'/start');await update(11,103,'/start');await prefs(103,{marketing_enabled:true});await update(12,103,'',true);
  const request_id='11111111-1111-4111-8111-111111111111';
  const campaign=await admin('saveCampaign',{request_id,content:valid,audience:{segment:'all'}});
  assert.equal(campaign.status,'draft');
  assert.equal((await admin('saveCampaign',{request_id,content:valid,audience:{segment:'all'}})).id,campaign.id);
  const future=new Date(Date.now()+3600000).toISOString();
  const launched=await admin('launchCampaign',{id:campaign.id,scheduled_at:future});assert.equal(launched.queued_count,1);assert.equal(launched.status,'scheduled');
  await admin('launchCampaign',{id:campaign.id});assert.equal(await count('campaign_id=$1',[campaign.id]),1);
  assert.equal(await count("campaign_id=$1 and context->'_content'->>'body'='Привет, {client_name}'",[campaign.id]),1);
  await prefs(101,{marketing_enabled:false});
  await q("update telegram_notifications set scheduled_at=now() where campaign_id=$1",[campaign.id]);
  await q('select * from krug_telegram_claim(50)');
  assert.equal(await count("campaign_id=$1 and status='skipped'",[campaign.id]),1);
  const overview=await admin('overview');assert.equal(overview.campaigns.find(c=>c.id===campaign.id).skipped_count,1);
  // Opt-out after claim must still be enforced.
  await prefs(101,{marketing_enabled:true});
  const c2=await admin('saveCampaign',{request_id:'22222222-2222-4222-8222-222222222222',content:valid,audience:{segment:'all'}});
  await admin('launchCampaign',{id:c2.id});const claimed=(await q('select * from krug_telegram_claim(50)')).find(n=>n.campaign_id===c2.id);assert.ok(claimed);
  await prefs(101,{marketing_enabled:false});assert.equal(await v('select krug_telegram_delivery_check($1,$2)',[claimed.id,claimed.lease_token]),false);
  // Block reports prevent future tests and exclude the client from audiences.
  await update(13,101,'',true);await assert.rejects(admin('testSend',{client_id:cid}),/CLIENT_UNAVAILABLE/);
  await update(14,101,'/start');assert.equal(await v('select telegram_blocked_at from clients where id=$1',[cid]),null);
  // Every privileged public RPC is service-role-only; all new tables keep RLS.
  const privileges=await q(`select p.oid::regprocedure::text name,has_function_privilege('anon',p.oid,'execute') a,
    has_function_privilege('authenticated',p.oid,'execute') b,has_function_privilege('service_role',p.oid,'execute') s
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'krug_telegram_%'`);
  assert.ok(privileges.length>=7);assert.ok(privileges.every(p=>!p.a&&!p.b&&p.s));
  assert.equal(await v("select relrowsecurity from pg_class where oid='telegram_templates'::regclass"),true);
  assert.equal(await v('select private.krug_tg_tick()'),false);
 }finally{await db.close();}
});
