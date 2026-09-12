// Run with PGLITE_MODULE pointing to @electric-sql/pglite (test-only dependency).
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {PGlite}=require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
test('staff scheduling SQL: migrations, schedules, qualification, room, assignment and permissions',async()=>{
 const db=new PGlite();
 const query=async(sql,args=[]) => (await db.query(sql,args)).rows;
 const value=async(sql,args=[])=>Object.values((await query(sql,args))[0])[0];
 try {
  // pgcrypto is unavailable in WASM. Only legacy demo password seeding uses these
  // fixture helpers; authentication/cryptography is deliberately not tested here.
  await db.exec(`create role anon;create role authenticated;create role service_role;
    create schema extensions;
    create function extensions.gen_salt(text,integer) returns text language sql as $$select 'fixture'::text$$;
    create function extensions.crypt(text,text) returns text language sql as $$select 'fixture-password'::text$$;
    create function extensions.digest(text,text) returns bytea language sql as $$select decode(md5($1),'hex')$$;`);
  const directory=path.resolve(__dirname,'../migrations');
  for(const file of fs.readdirSync(directory).filter(f=>f.endsWith('.sql')).sort()) {
    let sql=fs.readFileSync(path.join(directory,file),'utf8').replace('create extension if not exists pgcrypto;','');
    try{await db.exec(sql);}catch(e){throw Error(file+': '+e.message,{cause:e});}
  }
  const date=await value("select ((now() at time zone 'Europe/Moscow')::date+2)::text");
  const weekday=await value('select extract(isodow from $1::date)::int',[date]);
  const when=(time,d=date)=>`${d}T${time}:00+03:00`;
  const schedule={weekly:{[weekday]:[{start:'10:00',end:'18:00'}]},exceptions:{}};
  const duty=async(s,a,b)=>value('select private.krug_staff_on_duty($1::jsonb,$2::timestamptz,$3::timestamptz)',[JSON.stringify(s),a,b]);
  assert.equal(await duty(schedule,when('10:00'),when('18:00')),true);
  assert.equal(await duty(schedule,when('17:00'),when('19:00')),false);
  assert.equal(await duty({weekly:{[weekday]:[{start:'10:00',end:'12:00'},{start:'13:00',end:'18:00'}]},exceptions:{}},when('11:00'),when('14:00')),false);
  assert.equal(await duty({...schedule,exceptions:{[date]:[]}},when('10:00'),when('11:00')),false);
  const next=await value('select ($1::date+1)::text',[date]);
  const night={weekly:{[weekday]:[{start:'22:00',end:'02:00'}]},exceptions:{}};
  assert.equal(await duty(night,when('23:00'),when('01:00',next)),true);
  assert.equal(await duty({...night,exceptions:{[next]:[]}},when('23:00'),when('01:00',next)),false);
  assert.equal(await duty({...night,exceptions:{[next]:[{start:'00:00',end:'03:00'}]}},when('23:00'),when('01:00',next)),true);
  assert.equal(await value('select private.krug_validate_schedule($1)',[JSON.stringify({weekly:{1:[{start:'12:00',end:'12:00'}]},exceptions:{}})]),false);
  assert.equal(await value('select private.krug_validate_schedule($1)',[JSON.stringify({weekly:{},exceptions:{'2026-02-30':[]}})]),false);
  await db.exec("update public.studio_hours set is_open=true,opens_at='09:00',closes_at='23:00';update public.crm_staff_users set active=true,must_change_password=false;");
  const session=await value("insert into public.crm_staff_sessions(user_id) values('u1') returning token");
  const save=async(id,profile,version=0)=>value('select public.krug_crm_staff_schedule($1,$2,$3,$4)',[session,id,JSON.stringify(profile),version]);
  const profile={name:'AE XL',published:true,priority:10,schedule,serviceIds:['recording']};
  const saved=await save('u1',profile);assert.equal(saved.version,1);
  await save('u2',{...profile,name:'Миша',priority:20});
  await assert.rejects(save('u1',profile),/STAFF_SCHEDULE_CONFLICT/);
  const engineerSession=await value("insert into public.crm_staff_sessions(user_id) values('u2') returning token");
  await assert.rejects(value('select public.krug_crm_staff_schedule($1,$2)',[engineerSession,'u1']),/CRM_FORBIDDEN/);
  const availability=()=>value('select public.krug_available_slots($1,1,$2)',[date,'recording']);
  let a=await availability();assert.equal(a.staffBySlot['10:00'].defaultStaffId,'u1');
  assert.deepEqual(a.staffBySlot['10:00'].staff.map(s=>s.id),['u1','u2']);
  assert.equal(a.slots.includes('18:00'),true);
  assert.deepEqual(a.staffBySlot['18:00'].staff,[]);
  await db.exec("delete from public.staff_service_qualifications where staff_id='u1'");
  assert.equal((await availability()).staffBySlot['10:00'].defaultStaffId,'u2');
  await db.exec("insert into public.staff_service_qualifications values('u1','recording')");
  await db.query("update public.staff_booking_profiles set schedule=$1 where staff_id='u1'",[JSON.stringify({...schedule,exceptions:{[date]:[]}})]);
  assert.equal((await availability()).staffBySlot['10:00'].defaultStaffId,'u2');
  await db.query("update public.staff_booking_profiles set schedule=$1 where staff_id='u1'",[JSON.stringify(schedule)]);
  const bookingArgs=['11111111-1111-4111-8111-111111111111','recording',date,'10:00',1,'Анна','+79991234567',null,123,'',false,'u2'];
  const create=args=>value('select public.krug_create_booking_v4($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',args);
  const booking=await create(bookingArgs);assert.equal(booking.staffId,'u2');assert.equal(booking.staffName,'Миша');
  assert.equal((await availability()).slots.includes('10:00'),false);
  const retry=await create(bookingArgs);assert.equal(retry.id,booking.id);assert.equal(retry.staffId,'u2');
  await assert.rejects(create([...bookingArgs.slice(0,8),999,...bookingArgs.slice(9)]),/INVALID_REQUEST_ID/);
  await assert.rejects(create(['22222222-2222-4222-8222-222222222222',...bookingArgs.slice(1)]),/STAFF_UNAVAILABLE/);
  const history=await value('select public.krug_list_bookings_for_telegram(123)');assert.equal(history[0].staffId,'u2');
  const any=[...bookingArgs];any[0]='33333333-3333-4333-8333-333333333333';any[3]='11:00';any[11]=null;
  assert.equal((await create(any)).staffId,'u1');
  await db.exec("update public.services set staff_selection='required' where id='recording'");
  any[0]='44444444-4444-4444-8444-444444444444';any[3]='12:00';
  await assert.rejects(create(any),/STAFF_REQUIRED/);
  await db.exec("update public.services set staff_selection='optional' where id='recording'");
  await db.exec('set role service_role');
  assert.equal((await create(any)).staffId,'u1');
  await db.exec('reset role');
  assert.equal(Number(await value("select extract(epoch from (upper(private.krug_crm_interval($1))-lower(private.krug_crm_interval($1))))/60",[JSON.stringify({date,time:'16:00',duration:'90 мин'})])),90);
  const crm={bookings:[{id:'crm-one',date,time:'13:00',duration:'2 часа',status:'подтверждено'}]};
  await db.query('update public.crm_shared_state set data=$1',[JSON.stringify(crm)]);
  assert.equal((await availability()).slots.includes('13:00'),false);
  assert.equal((await availability()).slots.includes('14:00'),false);
  crm.bookings[0].time='10:00';
  await assert.rejects(db.query('update public.crm_shared_state set data=$1',[JSON.stringify(crm)]),/SLOT_UNAVAILABLE/);
  await db.exec("update public.crm_shared_state set data='{}'");
  await db.exec("update public.staff_booking_profiles set published=false");
  a=await availability();assert.ok(a.slots.length);assert.deepEqual(a.staffBySlot['10:00'].staff,[]);
  await db.exec("update public.services set staff_selection='required' where id='recording'");
  assert.equal((await availability()).slots.length,0);
  await db.exec("update public.services set staff_selection='optional' where id='recording'");
  const rental=await value('select public.krug_available_slots($1,1,$2)',[date,'rental']);
  assert.equal(rental.staffSelection,'none');assert.ok(rental.slots.length);
  for(const role of ['anon','authenticated']) {
    assert.equal(await value("select has_function_privilege($1,'public.krug_create_booking_v4(uuid,text,date,time,numeric,text,text,text,bigint,text,boolean,text)','execute')",[role]),false);
    assert.equal(await value("select has_table_privilege($1,'public.staff_booking_profiles','select')",[role]),false);
  }
  assert.equal(await value("select has_function_privilege('service_role','public.krug_create_booking_v3(uuid,text,date,time,numeric,text,text,text,bigint,text,boolean)','execute')"),false);
  assert.equal(await value("select bool_and(relrowsecurity) from pg_class where oid in ('public.staff_booking_profiles'::regclass,'public.staff_service_qualifications'::regclass)"),true);
  console.log('PASS SQL: migration chain, overnight/leave, qualification, optional/required assignment, retries, CRM room and grants');
 } finally {await db.close();}
});
