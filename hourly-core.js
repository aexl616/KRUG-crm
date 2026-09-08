/* Catalog-only migration and pure pricing. Historical transactions are untouched. */
(function(root) {
  const families = [
    {id:'hourly-recording',name:'Запись',categoryId:'recording',pattern:/^Запись (\d+) час(?:а|ов)?$/},
    {id:'hourly-morning',name:'Утренняя запись',categoryId:'recording',pattern:/^Запись утро (\d+) час(?:а|ов)?$/},
    {id:'hourly-recording-mix',name:'Запись + сведение',categoryId:'recording',pattern:/^Запись \+ сведение (\d+) час(?:а|ов)?$/},
    {id:'hourly-rent',name:'Аренда',categoryId:'rent',pattern:/^Аренда (\d+) час(?:а|ов)?$/}
  ];
  const money = value => Math.round(Number(value)*100)/100;
  function deriveTiers(existing) {
    const known = [...existing].sort((a,b)=>a.hours-b.hours);
    if (known.length<2 || known.some(t=>!Number.isFinite(t.totalPrice)||t.totalPrice<0||!Number.isInteger(t.hours)||t.hours<1)) throw Error('Недостаточно корректных исходных тарифов');
    return Array.from({length:8},(_,i)=>i+1).map(hours=>{
      const tier=known.find(t=>t.hours===hours);
      if(tier)return {...tier,source:'existing'};
      const upper=known.findIndex(t=>t.hours>hours);
      const b=upper<0?known.at(-1):known[upper],a=upper<0?known.at(-2):known[upper-1];
      if(!a)throw Error('Нет нижнего исходного тарифа');
      return {hours,totalPrice:money(a.totalPrice+(hours-a.hours)*(b.totalPrice-a.totalPrice)/(b.hours-a.hours)),source:'derived'};
    });
  }
  function calculateHourlyServicePrice(service,durationHours) {
    const hours=Number(durationHours);
    if(service?.pricingType!=='hourly'||!Number.isInteger(hours)||hours<1||hours>8)throw Error('Выберите длительность от 1 до 8 часов');
    const tier=service.priceTiers?.find(t=>t.hours===hours);
    if(!tier||!Number.isFinite(tier.totalPrice)||tier.totalPrice<0)throw Error('Тариф для этой длительности не задан');
    return {durationHours:hours,totalPrice:tier.totalPrice,effectiveHourlyRate:money(tier.totalPrice/hours),appliedTier:{...tier},source:tier.source};
  }
  function migrateCatalog(data) {
    let items=(data.serviceItems||[]).map(s=>({...s}));
    for(const family of families) {
      const old=items.filter(s=>family.pattern.test(s.name));
      let unified=items.find(s=>s.id===family.id && s.pricingType==='hourly');
      if(!unified) {
        const tiers=new Map();
        // Ambiguous duplicate prices need a human decision; retain that family as-is.
        if(old.some(s=>old.some(other=>other!==s&&other.name===s.name&&Number(other.price)!==Number(s.price))))continue;
        old.forEach(s=>{const hours=Number(s.name.match(family.pattern)[1]);if(!tiers.has(hours))tiers.set(hours,{hours,totalPrice:Number(s.price),source:'existing',legacyServiceId:s.id});});
        if(tiers.size<2 || items.some(s=>s.id===family.id))continue;
        let priceTiers;
        try { priceTiers=deriveTiers([...tiers.values()]); } catch { continue; }
        if(priceTiers.some(t=>t.totalPrice<0))continue;
        unified={id:family.id,name:family.name,categoryId:old[0]?.categoryId||family.categoryId,pricingType:'hourly',priceTiers,price:tiers.get(1)?.totalPrice||0,duration:'1 час',mode:'fixed',active:old.some(s=>s.active!==false),order:Math.min(...old.map(s=>Number(s.order)||1))};
        items.push(unified);
      }
      // Retain the original records/IDs/prices for history, but hide legacy options.
      items=items.map(s=>family.pattern.test(s.name)?{...s,hourlyReplacedBy:unified.id}:s);
      if(family.id==='hourly-rent')items=items.map(s=>s.name==='Почасовая'&&Number(s.price)===unified.priceTiers.find(t=>t.hours===1)?.totalPrice?{...s,hourlyReplacedBy:unified.id}:s);
    }
    return {...data,serviceItems:items};
  }
  const api={families,deriveTiers,calculateHourlyServicePrice,migrateCatalog};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.KrugHourly=api;
})(globalThis);
