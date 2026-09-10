/* Settings 2.0: pure validation, migrations, accrual and distribution. */
(function(root){
  const money=n=>Math.round((Number(n)||0)*100)/100;
  const modes=['percent','fixed_per_hour','fixed_per_booking'];
  const generalDefaults={studioName:'КРУГ',currency:'RUB',timezone:'Europe/Moscow',timeFormat:'24h',weekStartsOn:1,calendarStartHour:9,calendarEndHour:24,calendarSlotMinutes:60,defaultBookingDuration:60,defaultBookingStatus:'подтверждено',defaultStartView:'dashboard',workingDays:[1,2,3,4,5,6,0],reminderOffsets:{30:true,15:true,5:true},showClientFinance:true,confirmDestructiveActions:true};
  const payoutDefaults={completedOnly:true,includeCancelled:false,allowPlanned:true,allowOverpay:false,minAmount:1,rounding:0,calculationMode:'percent'};
  const finite=(n,min,max=Infinity)=>Number.isFinite(Number(n))&&Number(n)>=min&&Number(n)<=max;
  function validateGeneral(g){
    if(!String(g.studioName||'').trim())return 'Укажите название студии.';
    if(!/^[A-Z]{3}$/.test(g.currency||''))return 'Валюта: трёхбуквенный код, например RUB.';
    try{new Intl.DateTimeFormat('ru',{timeZone:g.timezone}).format();if(!g.timezone)throw Error();}catch{return 'Укажите существующий часовой пояс, например Europe/Moscow.';}
    if(!['24h','12h'].includes(g.timeFormat)||![0,1].includes(g.weekStartsOn))return 'Проверьте формат времени и начало недели.';
    if(!Number.isInteger(g.calendarStartHour)||!Number.isInteger(g.calendarEndHour)||!finite(g.calendarStartHour,0,23)||!finite(g.calendarEndHour,1,24)||g.calendarEndHour<=g.calendarStartHour)return 'Конец рабочего дня должен быть позже начала (0–24).';
    if(![15,30,60].includes(g.calendarSlotMinutes))return 'Шаг календаря: 15, 30 или 60 минут.';
    if(!finite(g.defaultBookingDuration,15,1440))return 'Длительность по умолчанию: от 15 до 1440 минут.';
    if(!['заявка','подтверждено','в процессе','завершено','отменено'].includes(g.defaultBookingStatus)||!['dashboard','calendar','bookings'].includes(g.defaultStartView))return 'Проверьте статус записи и стартовый экран.';
    if(!Array.isArray(g.workingDays)||!g.workingDays.length||g.workingDays.some(d=>!Number.isInteger(d)||d<0||d>6))return 'Выберите хотя бы один рабочий день.';
    return '';
  }
  function validatePayouts(p){return !finite(p.minAmount,0)||![0,10,50,100].includes(p.rounding)||!modes.includes(p.calculationMode)?'Проверьте минимум, округление и способ расчёта.':'';}
  function employeeParams(e,p=payoutDefaults){return {payoutMode:modes.includes(e.payoutMode)?e.payoutMode:Number(e.fixedRate)>0?'fixed_per_booking':p.calculationMode,payoutPercent:Number(e.payoutPercent??e.percent??100),payoutHourlyRate:Number(e.payoutHourlyRate??0),payoutFixedAmount:Number(e.payoutFixedAmount??e.fixedRate??0)};}
  function validateEmployee(e){return !modes.includes(e.payoutMode)||!finite(e.payoutPercent,0,100)||!finite(e.payoutHourlyRate,0)||!finite(e.payoutFixedAmount,0)?'Процент должен быть 0–100, ставки — неотрицательными.':'';}
  function durationHours(b){const v=String(b.duration??'1 час').toLowerCase(),n=Number(v.match(/\d+(?:[.,]\d+)?/)?.[0].replace(',','.')||1);return /мин/.test(v)?n/60:/день|дня|дней/.test(v)?8:Number(b.duration)>24?n/60:n;}
  function earningRule(e,p){return {...employeeParams(e,p),completedOnly:p.completedOnly,includeCancelled:p.includeCancelled,rounding:p.rounding};}
  function calculateEmployeeEarning(b,e={},p=payoutDefaults){
    const rule=b.earningSnapshot && b.earningSnapshot.employeeId===(e.id||b.employeeId)?b.earningSnapshot:earningRule(e,p);
    if(b.status==='отменено'?!rule.includeCancelled:rule.completedOnly&&b.status!=='завершено')return 0;
    let value=rule.payoutMode==='fixed_per_hour'?durationHours(b)*rule.payoutHourlyRate:rule.payoutMode==='fixed_per_booking'?rule.payoutFixedAmount:Number(b.amount||0)*rule.payoutPercent/100;
    if(rule.rounding)value=Math.round(value/rule.rounding)*rule.rounding;
    return money(Math.max(0,value));
  }
  function validatePayout(amount,available,status,p){
    if(!finite(amount,0)||Number(amount)<=0)return 'Укажите положительную сумму.';
    if(!['Выплачено','Запланировано'].includes(status))return 'Некорректный статус выплаты.';
    if(status==='Запланировано'&&!p.allowPlanned)return 'Плановые выплаты отключены владельцем.';
    if(Number(amount)<p.minAmount)return `Минимальная выплата: ${p.minAmount}.`;
    if(!p.allowOverpay&&money(amount)>money(available))return 'Выплата превышает доступный заработок.';
    return '';
  }
  function validateDistribution(d){
    const ids=new Set(),names=new Set();
    for(const w of d.wallets||[]){if(!w.id||ids.has(w.id)||names.has(String(w.name).trim().toLowerCase())||!String(w.name||'').trim()||!finite(w.percent,0,100))return 'У кошельков должны быть уникальные ID, названия и проценты 0–100.';ids.add(w.id);names.add(String(w.name).trim().toLowerCase());}
    const active=(d.wallets||[]).filter(w=>w.active!==false);
    if(!active.length||Math.abs(active.reduce((s,w)=>s+Number(w.percent),0)-100)>.00001)return 'Сумма процентов активных кошельков должна быть 100%.';
    for(const [category,r] of Object.entries(d.rules||{})){
      if(Object.entries(r).some(([id,p])=>!ids.has(id)||!finite(p,0,100)||(Number(p)>0&&!active.some(w=>w.id===id)))||Math.abs(Object.values(r).reduce((s,p)=>s+Number(p),0)-100)>.00001)return `Категория «${category}»: сумма должна быть 100%, только активные кошельки.`;
    }
    return '';
  }
  function distributionSnapshot(amount,category,d){
    const rule=d.rules[category]||Object.fromEntries(d.wallets.filter(w=>w.active!==false).map(w=>[w.id,w.percent]));
    const rows=Object.entries(rule).filter(([,p])=>Number(p)>0);let remaining=Math.round(Number(amount)*100);
    return {version:1,categoryId:category,amount:money(amount),allocations:rows.map(([id,percent],index)=>{const cents=index===rows.length-1?remaining:Math.round(Number(amount)*Number(percent));remaining-=cents;return {walletId:id,name:d.wallets.find(w=>w.id===id)?.name||id,percent:Number(percent),amount:cents/100};})};
  }
  function migrate(data,legacyRules={}){
    const old=data.settings||{},first=!old.version;
    const rawGeneral={...generalDefaults,...Object.fromEntries(Object.entries(data.calendarSettings||{}).filter(([k])=>Object.hasOwn(generalDefaults,k))),...old.general};
    const general={...rawGeneral,reminderOffsets:{...generalDefaults.reminderOffsets,...old.general?.reminderOffsets}};
    // Validate groups independently; keep unrelated valid imported settings.
    if(validateGeneral(general)){for(const key of Object.keys(generalDefaults))if(general[key]===undefined)general[key]=generalDefaults[key];if(validateGeneral(general))Object.assign(general,generalDefaults,{studioName:String(general.studioName||'КРУГ')});}
    const payouts={...payoutDefaults,...old.payouts};if(validatePayouts(payouts))Object.assign(payouts,payoutDefaults);
    let distribution=old.distribution;
    if(!distribution?.wallets){
      const names=new Set(['общак','AE XL','Резерв аренды','Оборудование','Реклама','Налоги','Прочее']);
      Object.values(data.budgetRules||legacyRules).forEach(r=>{Object.keys(r.wallets||{}).forEach(n=>names.add(n));Object.keys(r.outside||{}).forEach(n=>names.add(n));});
      const wallets=[...names].map((name,i)=>({id:`wallet-${i}`,name,active:true,percent:i===0?100:0}));
      const convert=r=>{const entries=[...Object.entries(r.wallets||{}),...Object.entries(r.outside||{})];return Object.fromEntries(entries.map(([name,p])=>[wallets.find(w=>w.name===name).id,Number(p)*100]));};
      const rules={};const source=data.budgetRules||legacyRules;
      for(const g of data.serviceGroups||[]){const key=g.id==='recording'?'recording':g.id==='rent'?'rent':['mixing','production'].includes(g.id)?'studioProduction':['education','consulting','design'].includes(g.id)?'online':g.id;const r=source[g.id]||source[key]||source.unknown;if(r)rules[g.id]=convert(r);}
      if(source.online)rules.online=convert(source.online);
      distribution={...distribution,wallets,rules};
    }
    distribution={...distribution,rules:distribution.rules||{}};
    // Retire unused default expense envelopes once, without touching financial history.
    if(!distribution.expenseDefaultsRemoved){
      const retired=new Set(['Реклама','Налоги','Прочее','Резерв аренды']);
      const removable=new Set(distribution.wallets.filter(w=>retired.has(w.name)&&Number(w.percent)===0
        &&Object.values(distribution.rules).every(rule=>!Number(rule[w.id]))
        &&!(data.payments||[]).some(payment=>{
          const snapshot=payment.distributionSnapshot;
          return snapshot?.allocations?.some(a=>a.walletId===w.id)||Number(snapshot?.wallets?.[w.name])||Number(snapshot?.outside?.[w.name]);
        })).map(w=>w.id));
      distribution={...distribution,expenseDefaultsRemoved:true,wallets:distribution.wallets.filter(w=>!removable.has(w.id)),rules:Object.fromEntries(Object.entries(distribution.rules).map(([category,rule])=>[category,Object.fromEntries(Object.entries(rule).filter(([id])=>!removable.has(id)))]))};
    }
    const settings={...old,version:1,general,payouts,distribution};
    const users=(data.users||[]).map(e=>({...e,...employeeParams(e,payouts)}));
    const bookings=(data.bookings||[]).map(b=>first&&b.status==='завершено'&&!b.earningSnapshot?{...b,earningSnapshot:{employeeId:b.employeeId||users.find(e=>e.name===(b.employeeName||b.employee))?.id||'',payoutMode:'percent',payoutPercent:100,completedOnly:true,includeCancelled:false,rounding:0,source:'legacy'}}:b);
    const notificationSettings={...data.notificationSettings};
    for(const e of users)notificationSettings[e.id]=notificationSettings[e.id]?{...notificationSettings[e.id],offsets:{30:true,15:true,5:true,...notificationSettings[e.id].offsets}}:{offsets:{...general.reminderOffsets}};
    return {...data,settings,users,bookings,notificationSettings};
  }
  function zonedParts(date,timezone){return Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));}
  function zonedDate(date,timezone){const p=zonedParts(date,timezone);return `${p.year}-${p.month}-${p.day}`;}
  function eventTimestamp(date,time,timezone){const target=Date.parse(`${date}T${time||'00:00'}:00Z`);if(!Number.isFinite(target))return NaN;let guess=target;for(let i=0;i<3;i++){const p=zonedParts(new Date(guess),timezone),wall=Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);guess+=target-wall;}return guess;}
  const api={generalDefaults,payoutDefaults,modes,migrate,validateGeneral,validatePayouts,employeeParams,validateEmployee,earningRule,calculateEmployeeEarning,validatePayout,validateDistribution,distributionSnapshot,zonedParts,zonedDate,eventTimestamp};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.KrugSettings=api;
})(globalThis);
