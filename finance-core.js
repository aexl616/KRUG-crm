/* Pure Finance 2.0 calculations. No DOM, storage, network or role side effects. */
(function(root) {
  const categories = ['Аренда','Коммунальные','Интернет/связь','Оборудование','Ремонт','Расходники','Реклама','Подписки/софт','Подрядчики','Транспорт','Налоги','Прочее'];
  const periods = {today:'Сегодня',week:'Неделя',month:'Месяц',lastMonth:'Прошлый месяц',all:'Всё время'};
  const cents = n => Number.isFinite(Number(n)) ? Math.round(Number(n) * 100) : 0;
  const amount = n => cents(n) / 100;
  const sum = (rows, pick = x => x.amount) => rows.reduce((total,row) => total + cents(pick(row)),0) / 100;
  const key = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const dateValue = d => String(d || '').slice(0,10);
  function validDate(d) { if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false; const value = new Date(d+'T12:00:00'); return Number.isFinite(+value) && key(value) === d; }
  function periodRange(period = 'month', now = new Date()) {
    const today = key(now), y = now.getFullYear(), m = now.getMonth();
    if (period && typeof period === 'object') {
      if (!validDate(period.start) || !validDate(period.end) || period.start > period.end) throw new Error('Некорректный период');
      return {start:period.start,end:period.end,label:'Выбранный период'};
    }
    if (period === 'all') return {start:'0001-01-01',end:today,label:periods.all};
    if (period === 'today') return {start:today,end:today,label:periods.today};
    if (period === 'week') { const d = new Date(y,m,now.getDate(),12); d.setDate(d.getDate()-(d.getDay()+6)%7); const start=key(d); d.setDate(d.getDate()+6); return {start,end:key(d),label:periods.week}; }
    const previous = period === 'lastMonth';
    return {start:key(new Date(y,m-(previous?1:0),1)),end:key(new Date(y,m+(previous?0:1),0)),label:previous?periods.lastMonth:periods.month};
  }
  function migrate(data, now = new Date()) {
    return {...data, expenses:(Array.isArray(data.expenses)?data.expenses:[]).map(e => ({...e,id:e.id || crypto.randomUUID(),date:e.date || key(now),category:categories.includes(e.category)?e.category:'Прочее',title:e.title || 'Расход',amount:amount(e.amount),employeeId:e.employeeId || '',comment:e.comment || '',recurring:e.recurring === true || e.recurring === 'monthly',createdAt:e.createdAt || now.toISOString(),updatedAt:e.updatedAt || e.createdAt || now.toISOString()})),financePlan:{...data.financePlan,monthlyRevenueTarget:Math.max(0,amount(data.financePlan?.monthlyRevenueTarget)),monthlyExpenseLimit:Math.max(0,amount(data.financePlan?.monthlyExpenseLimit))}};
  }
  const paid = p => !p.status || p.status === 'Выплачено';
  const payoutDate = p => dateValue(p.paidAt || p.createdAt);
  const expenseSignature = e => JSON.stringify([e.category || 'Прочее',String(e.title || '').trim().toLowerCase(),e.employeeId || '']);
  function employeeId(data,b) { return b.employeeId || (data.users || []).find(u=>u.name === (b.employeeName || b.employee))?.id || ''; }
  function employeeRows(data, end, includeFuturePlans = false) {
    const bookings = (data.bookings || []).filter(b=>b.status==='завершено' && b.date<=end);
    const payouts = (data.payouts || []).filter(p=>p.status!=='Отменено');
    const resolvePayout = p => p.employeeId || (data.users || []).find(u=>u.name===(p.employeeName || p.recipient))?.id || '';
    const ids = new Set([...(data.users || []).map(u=>u.id),...bookings.map(b=>employeeId(data,b)),...payouts.map(resolvePayout)]);
    return [...ids].map(id=>{
      const employee=(data.users || []).find(u=>u.id===id) || null;
      const completed=bookings.filter(b=>employeeId(data,b)===id && cents(b.amount)>0);
      const payments=payouts.filter(p=>resolvePayout(p)===id && paid(p) && payoutDate(p)<=end && validDate(payoutDate(p)));
      const planned=payouts.filter(p=>resolvePayout(p)===id && p.status==='Запланировано' && (includeFuturePlans || payoutDate(p)<=end));
      // Preserve the existing CRM accrual rule: the full completed booking amount.
      const earned=sum(completed), paidTotal=sum(payments,p=>Math.max(0,amount(p.amount))), plannedTotal=sum(planned,p=>Math.max(0,amount(p.amount)));
      const outstanding=Math.max(0,amount(earned-paidTotal));
      const last=[...payments].sort((a,b)=>String(b.paidAt || b.createdAt).localeCompare(String(a.paidAt || a.createdAt)))[0];
      return {id,employee,name:employee?.name || (id?'Удалённый сотрудник':'Без сотрудника'),earned,paid:paidTotal,planned:plannedTotal,outstanding,available:Math.max(0,amount(outstanding-plannedTotal)),reserve:Math.max(outstanding,plannedTotal),overpaid:Math.max(0,amount(paidTotal+plannedTotal-earned)),lastPayout:last || null,completedBookings:completed};
    });
  }
  function stats(data, period='month', now=new Date()) {
    const range=periodRange(period,now),today=key(now),end=range.end<today?range.end:today;
    const inside=d=>validDate(dateValue(d)) && dateValue(d)>=range.start && dateValue(d)<=end;
    const until=d=>validDate(dateValue(d)) && dateValue(d)<=end;
    const bookings=data.bookings || [],payments=data.payments || [],expenses=data.expenses || [],payouts=data.payouts || [];
    const completed=bookings.filter(b=>b.status==='завершено' && inside(b.date));
    const actualPayments=payments.filter(p=>inside(p.date));
    const actualExpenses=expenses.filter(e=>inside(e.date));
    const actualPayouts=payouts.filter(p=>paid(p) && inside(payoutDate(p)));
    const linked = b => payments.filter(p=>p.bookingId === b.id || (!p.bookingId && p.id === b.paymentId));
    const received = b => sum(linked(b).filter(p=>until(p.date)));
    const unpaid = b => Math.max(0,amount(amount(b.amount)-received(b)));
    const employees=employeeRows(data,end,end===today);
    const revenue=sum(completed),cashIn=sum(actualPayments),expenseTotal=sum(actualExpenses),payoutsPaid=sum(actualPayouts);
    const netCash=amount(cashIn-expenseTotal-payoutsPaid);
    const cashBalanceAsOf=amount(sum(payments.filter(p=>until(p.date)))-sum(expenses.filter(e=>until(e.date)))-sum(payouts.filter(p=>paid(p)&&until(payoutDate(p)))));
    const employeeOutstanding=sum(employees,e=>e.outstanding),obligationsReserve=sum(employees,e=>e.reserve);
    const freeCashAfterObligations=amount(cashBalanceAsOf-obligationsReserve);
    const rank = (rows,label) => { const groups=new Map();rows.forEach(row=>{const name=label(row);groups.set(name,(groups.get(name)||0)+cents(row.amount));});return [...groups].map(([name,value])=>({name,amount:value/100})).sort((a,b)=>b.amount-a.amount); };
    const month=periodRange('month',now),monthInside=d=>validDate(dateValue(d)) && dateValue(d)>=month.start && dateValue(d)<=month.end;
    const monthCompleted=bookings.filter(b=>b.status==='завершено' && monthInside(b.date) && b.date<=today);
    const future=bookings.filter(b=>b.status==='подтверждено' && monthInside(b.date) && new Date(`${b.date}T${b.time || '00:00'}`).getTime()>now.getTime());
    const monthExpenses=expenses.filter(e=>monthInside(e.date));
    const recurringGroups=new Map();
    expenses.filter(e=>validDate(e.date) && e.date<=month.end).forEach(e=>{const k=expenseSignature(e),old=recurringGroups.get(k);if(!old || e.date>old.date || (e.date===old.date && String(e.updatedAt)>String(old.updatedAt)))recurringGroups.set(k,e);});
    const projectedExpenses=[...recurringGroups.values()].filter(e=>e.recurring && !monthExpenses.some(p=>expenseSignature(p)===expenseSignature(e)));
    const forecastExpenses=sum([...monthExpenses,...projectedExpenses]);
    const currentEmployees=employeeRows({...data,payouts:payouts.filter(p=>p.status!=='Запланировано' || payoutDate(p)<=month.end)},today,true);
    const monthPaid=sum(payouts.filter(p=>paid(p) && monthInside(payoutDate(p)) && payoutDate(p)<=today));
    const futureEarnedById=new Map();future.forEach(b=>{const id=employeeId(data,b);futureEarnedById.set(id,(futureEarnedById.get(id)||0)+cents(b.amount));});
    const forecastReserve=sum(currentEmployees,e=>Math.max(amount(e.outstanding+(futureEarnedById.get(e.id)||0)/100),e.planned));
    const missingFutureReserve=[...futureEarnedById].filter(([id])=>!currentEmployees.some(e=>e.id===id)).reduce((n,[,value])=>n+value,0)/100;
    const forecastPayouts=amount(monthPaid+forecastReserve+missingFutureReserve);
    const forecastRevenue=amount(sum(monthCompleted)+sum(future));
    const currentUnpaid=bookings.filter(b=>b.status==='завершено' && b.date<=today).reduce((total,b)=>total+Math.max(0,cents(b.amount)-cents(sum(linked(b).filter(p=>dateValue(p.date)<=today)))),0)/100;
    const futureCash=sum(future,b=>Math.max(0,amount(amount(b.amount)-sum(linked(b).filter(p=>dateValue(p.date)<=today)))));
    const openingCash=amount(sum(payments.filter(p=>validDate(p.date)&&p.date<month.start))-sum(expenses.filter(e=>validDate(e.date)&&e.date<month.start))-sum(payouts.filter(p=>paid(p)&&validDate(payoutDate(p))&&payoutDate(p)<month.start)));
    const forecastFreeCash=amount(openingCash+sum(payments.filter(p=>monthInside(p.date)&&p.date<=today))+currentUnpaid+futureCash-forecastExpenses-forecastPayouts);
    const target=Math.max(0,amount(data.financePlan?.monthlyRevenueTarget)),limit=Math.max(0,amount(data.financePlan?.monthlyExpenseLimit));
    const monthActualRevenue=sum(monthCompleted),monthActualExpenses=sum(monthExpenses.filter(e=>e.date<=today));
    const warnings=[];
    const add=(code,severity,title,entityType='',entityId='',value=null,description='')=>warnings.push({code,severity,level:severity,type:title,title,entityType,targetId:entityId,action:['booking','payment','payout'].includes(entityType)?entityType:'',amount:value,description,employeeId:entityType==='employee'?entityId:'',date:''});
    completed.forEach(b=>{
      const receivedAmount=received(b),due=unpaid(b);
      if (!employeeId(data,b)) add('booking_without_employee','critical','Запись без сотрудника','booking',b.id,null,b.client || b.clientName || '');
      if (!linked(b).filter(p=>until(p.date)).length) add('unpaid_booking','critical','Завершённая запись без оплаты','booking',b.id,amount(b.amount),b.client || '');
      else if(due>0) add('underpayment','warning','Недоплата по записи','booking',b.id,due,b.client || '');
      if(receivedAmount>amount(b.amount)) add('overpayment','warning','Переплата по записи','booking',b.id,amount(receivedAmount-amount(b.amount)),b.client || '');
    });
    bookings.filter(b=>inside(b.date)&&b.status!=='завершено'&&b.status!=='отменено'&&!employeeId(data,b)).forEach(b=>add('booking_without_employee','warning','Запись без сотрудника','booking',b.id,null,b.client || ''));
    actualPayments.forEach(p=>{if(!bookings.some(b=>p.bookingId===b.id || (!p.bookingId && b.paymentId===p.id)))add('unlinked_payment','info','Платёж без записи','payment',p.id,amount(p.amount),p.client || '');});
    employees.filter(e=>e.overpaid>0).forEach(e=>add('payout_over_earned','critical','Выплаты превышают начисления','employee',e.id,e.overpaid,e.name));
    actualExpenses.forEach(e=>{if(cents(e.amount)<=0)add('invalid_expense','critical','Расход должен быть больше нуля','expense',e.id,amount(e.amount),e.title);});
    const recurring=new Map();actualExpenses.filter(e=>e.recurring).forEach(e=>{const id=expenseSignature(e)+e.date.slice(0,7);if(recurring.has(id))add('duplicate_recurring','warning','Повтор ежемесячного расхода','expense',e.id,amount(e.amount),e.title);else recurring.set(id,e);});
    const plannedPayouts=sum(employees,e=>e.planned);
    if(plannedPayouts>Math.max(0,cashBalanceAsOf))add('planned_over_cash','critical','План выплат превышает остаток','', '',amount(plannedPayouts-cashBalanceAsOf));
    if(freeCashAfterObligations<0)add('negative_free_cash','critical','Отрицательный свободный остаток','','',freeCashAfterObligations);
    if(limit>0 && monthActualExpenses>limit)add('expense_limit','critical','Превышен лимит расходов месяца','','',amount(monthActualExpenses-limit),month.start.slice(0,7));
    const health=warnings.some(w=>w.severity==='critical') || freeCashAfterObligations<0 ? 'Риск' : (limit>0&&monthActualExpenses>limit*.8)||employeeOutstanding>Math.max(0,cashBalanceAsOf)||warnings.some(w=>w.severity==='warning') ? 'Внимание':'Хорошо';
    const serviceRevenue=rank(completed,b=>b.serviceName || b.service || 'Без услуги'),clientRevenue=rank(completed,b=>b.clientName || b.client || 'Без клиента');
    return {period:range,asOf:end,revenue,cashIn,unpaidRevenue:sum(completed,unpaid),receivedForCompleted:sum(completed,b=>Math.min(amount(b.amount),received(b))),expenses:expenseTotal,payoutsPaid,employeeEarned:sum(completed,b=>Math.max(0,amount(b.amount))),employeeOutstanding,plannedPayouts,netCash,openingCash:amount(cashBalanceAsOf-netCash),cashBalanceAsOf,obligationsReserve,freeCashAfterObligations,averageCheck:completed.length?amount(revenue/completed.length):0,completedBookings:completed.length,employees,forecastRevenue,forecastExpenses,forecastPayouts,forecastFreeCash,forecastMonth:month,forecastReceivables:currentUnpaid,forecastFutureCash:futureCash,projectedExpenses,plan:{revenueTarget:target,revenueActual:monthActualRevenue,revenuePercent:target?Math.round(monthActualRevenue/target*100):null,revenueRemaining:Math.max(0,amount(target-monthActualRevenue)),expenseLimit:limit,expenseActual:monthActualExpenses,expenseRemaining:limit?amount(limit-monthActualExpenses):null},expenseCategories:rank(actualExpenses,e=>e.category || 'Прочее'),largestExpense:[...actualExpenses].sort((a,b)=>b.amount-a.amount)[0] || null,serviceRevenue,employeeRevenue:rank(completed,b=>(data.users || []).find(u=>u.id===employeeId(data,b))?.name || 'Без сотрудника'),topService:serviceRevenue[0] || null,topClient:clientRevenue[0] || null,warnings,health};
  }
  const api={categories,periods,periodRange,validDate,migrate,stats,employeeRows,amount,key,sum};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.KrugFinance=api;
})(globalThis);
