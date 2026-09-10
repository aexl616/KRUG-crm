/* Finance 2.0 integration: current stack and business entities are preserved. */
dataStore.addNormalizer(KrugFinance.migrate);
state = KrugFinance.migrate(state);
let financePeriod = 'month';
let expenseCategoryFilter = '';
let expenseRecurringFilter = '';
let expenseSearch = '';
let expenseEditingId = null;
let expenseFormOpen = false;
let financeFeedback = '';
const financeEscape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function canManageExpenses() { return Boolean(currentUser()) && isManagerRole(); }
function financeStats(period=financePeriod,now=new Date()) { return KrugFinance.stats(state,period,now); }
function financeEmployeePayoutStats(id) {
  const row=KrugFinance.employeeRows(state,KrugFinance.key(new Date()),true).find(e=>e.id===id);
  return {employee:row?.employee || null,completedBookings:row?.completedBookings || [],completedBookingsCount:row?.completedBookings.length || 0,totalEarned:row?.earned || 0,totalPaid:row?.paid || 0,totalPlanned:row?.planned || 0,availableToPay:row?.available || 0,overpaid:row?.overpaid || 0,lastPayoutDate:payoutDateValue(row?.lastPayout),lastPayoutAmount:row?.lastPayout?.amount || 0};
}
const financeOriginalWarnings=financialWarnings;
financialWarnings=function financeWarnings() {
  const replaced=['Завершённая запись без платежа','Запись завершена без сотрудника','Сумма платежа отличается от записи','У сотрудника переплата','Выплата превышает доступную сумму'];
  return [...financeStats('all').warnings,...financeOriginalWarnings().filter(w=>!replaced.includes(w.type))];
};
function saveExpense(data,id='') {
  if(!canManageExpenses()) return {ok:false,error:'Нет доступа к расходам.'};
  const previous=state.expenses.find(e=>e.id===id);
  if(id&&!previous)return {ok:false,error:'Расход больше не существует.'};
  if(!KrugFinance.validDate(data.date) || data.date>KrugFinance.key(new Date()))return {ok:false,error:'Укажите корректную дату не позже сегодняшней. Будущие расходы учитываются в прогнозе.'};
  if(!String(data.title || '').trim() || !KrugFinance.categories.includes(data.category))return {ok:false,error:'Укажите название и категорию.'};
  if(!Number.isFinite(Number(data.amount)) || KrugFinance.amount(data.amount)<=0)return {ok:false,error:'Сумма должна быть больше нуля.'};
  if(data.employeeId && !state.users.some(u=>u.id===data.employeeId))return {ok:false,error:'Выбранный сотрудник не найден.'};
  const now=new Date().toISOString();
  const before=structuredClone(state);
  const expense={...previous,id:previous?.id || crypto.randomUUID(),date:data.date,title:String(data.title).trim(),category:data.category,amount:KrugFinance.amount(data.amount),employeeId:data.employeeId || '',comment:String(data.comment || '').trim(),recurring:data.recurring===true || data.recurring==='on',createdAt:previous?.createdAt || now,updatedAt:now};
  if(previous)state.expenses=state.expenses.map(e=>e.id===id?expense:e);else state.expenses.push(expense);
  if(!saveState()){state=before;return {ok:false,error:'Не удалось сохранить расход. Прежние данные сохранены; попробуйте ещё раз.'};}return {ok:true,expense};
}
function deleteExpense(id) {
  if(!canManageExpenses())return false;
  const expense=state.expenses.find(e=>e.id===id);
  if(!expense || !confirmDestructive(`Удалить расход «${expense.title}» на ${money(expense.amount)}? Это изменит финансовые итоги.`))return false;
  const before=structuredClone(state);state.expenses=state.expenses.filter(e=>e.id!==id);if(!saveState()){state=before;return false;}return true;
}
function saveFinancePlan(data) {
  if(!currentUser() || !isOwner())return false;
  const target=Number(data.monthlyRevenueTarget),limit=Number(data.monthlyExpenseLimit);
  if(!Number.isFinite(target)||!Number.isFinite(limit)||target<0||limit<0)return false;
  const before=structuredClone(state);state.financePlan={monthlyRevenueTarget:KrugFinance.amount(target),monthlyExpenseLimit:KrugFinance.amount(limit)};if(!saveState()){state=before;return false;}return true;
}
function financePeriodControl() {
  const range=KrugFinance.periodRange(financePeriod);
  return `<div class="f-date-range"><label class="f-period">Период<select data-finance-period>${Object.entries(KrugFinance.periods).map(([k,v])=>`<option value="${k}" ${financePeriod===k?'selected':''}>${v}</option>`).join('')}${typeof financePeriod==='object'?'<option value="custom" selected>Выбранные даты</option>':''}</select></label><label class="f-period">С даты<input type="date" data-finance-from value="${range.start==='0001-01-01'?'':range.start}"></label><label class="f-period">По дату включительно<input type="date" data-finance-to value="${range.end}"></label><button type="button" class="btn secondary" data-finance-apply>Показать</button><p class="f-error" role="alert" data-finance-date-error></p></div>`;
}
function financeMetric(label,value,note='') { return `<article class="card f-metric"><span>${label}</span><strong>${money(value)}</strong><small>${financeEscape(note)}</small></article>`; }
function financeBars(rows) {
  const max=Math.max(1,...rows.map(r=>r.amount));
  return rows.length?`<div class="f-bars">${rows.map(r=>`<div><span>${financeEscape(r.name)}</span><strong>${money(r.amount)}</strong><meter min="0" max="${max}" value="${Math.max(0,r.amount)}">${money(r.amount)}</meter></div>`).join('')}</div>`:'<p class="muted">Нет данных за выбранный период.</p>';
}
function financeWarningsHtml(warnings) {
  return warnings.length?`<div class="f-warnings">${warnings.map(w=>`<article class="f-warning" data-severity="${w.severity}"><strong>${financeEscape(w.title)}</strong><span>${financeEscape(w.description)}</span>${w.amount!==null?`<b>${money(w.amount)}</b>`:''}<small>${{critical:'Риск',warning:'Внимание',info:'Информация'}[w.severity]}</small>${w.entityType==='expense'?`<button type="button" class="btn secondary" data-expense-edit="${financeEscape(w.targetId)}">Открыть расход</button>`:w.action==='booking'?`<button type="button" class="btn secondary" data-open-booking="${financeEscape(w.targetId)}">Открыть запись</button>`:w.action==='payment'?`<button type="button" class="btn secondary" data-open-payment="${financeEscape(w.targetId)}">Открыть оплату</button>`:''}</article>`).join('')}</div>`:'<p class="muted">Предупреждений по выбранному периоду нет.</p>';
}
let financeTab='money';
function financeTabs() {
  return '<nav class="f-tabs" aria-label="Финансовый обзор">'+[['money','Деньги'],['attention','Что проверить'],['planning','План и аналитика']].map(([id,label])=>`<button type="button" class="btn ${financeTab===id?'':'secondary'}" data-finance-tab="${id}" aria-pressed="${financeTab===id}">${label}</button>`).join('')+'</nav>';
}
renderFinance=function renderFinanceDashboard() {
  if(!currentUser() || !canViewFinance())return '<p>Нет доступа к финансовому обзору.</p>';
  const s=financeStats(),p=s.plan,esc=financeEscape;
  return `<div class="finance-v2"><header class="f-toolbar"><div><h2>Деньги студии</h2><p class="muted">Оплаты, расходы и расчёты с командой — отдельно от прогнозов.</p></div>${financeTab!=='planning'?financePeriodControl():''}</header>
  ${financeTabs()}
  ${financeFeedback?`<p class="f-feedback" role="status">${esc(financeFeedback)}</p>`:''}
  ${financeTab==='money'?`
  <p class="muted">${esc(s.period.label)} · по ${esc(s.asOf)}. Только внесённые операции, не баланс банковского счёта.</p>
  <div class="f-kpis f-primary">${financeMetric('Получено от клиентов',s.cashIn,'Оплаты, внесённые за выбранный период')}${financeMetric('Потрачено всего',KrugFinance.amount(s.expenses+s.payoutsPaid),'Расходы студии + выданные выплаты команде')}${financeMetric('Осталось от поступлений',s.netCash,'Получено минус потрачено за этот период')}</div>
  <section class="card section"><h2>Что хотите сделать?</h2><div class="f-actions"><button class="btn secondary" data-view="payments">Проверить оплаты клиентов →</button><button class="btn secondary" data-view="expenses">Записать расход →</button><button class="btn secondary" data-view="payouts">Выплатить команде →</button></div><p class="muted">Запись расхода или выплаты фиксирует учёт, но не переводит деньги.</p></section>
  <div class="f-grid"><section class="card section"><h2>Сколько ещё выдать команде</h2><strong class="f-amount">${money(s.employeeOutstanding)}</strong><p class="muted">Накопленный долг по ${esc(s.asOf)}, включая запланированные выплаты. Это не дополнительный расход, пока деньги не выданы.</p><button class="btn secondary" data-view="payouts">Посмотреть сотрудников</button></section>
  <section class="card section"><h2>Нужно проверить</h2><p>${s.warnings.length?'Замечаний: '+s.warnings.length:'Замечаний по выбранному периоду нет.'}</p><p class="muted">Связи оплат с записями, недоплаты и возможные ошибки учёта.</p><button class="btn secondary" data-finance-tab="attention">Открыть проверку</button></section></div>
  <details class="f-details"><summary>Как получился остаток · все расчёты</summary><section class="card section f-cash"><h2>Деньги студии</h2><dl><div><dt>Поступило за период</dt><dd>${money(s.cashIn)}</dd></div><div><dt>− Расходы</dt><dd>${money(s.expenses)}</dd></div><div><dt>− Выплаты</dt><dd>${money(s.payoutsPaid)}</dd></div><div class="f-total"><dt>= Остаток за период</dt><dd>${money(s.netCash)}</dd></div><div><dt>Остаток до периода</dt><dd>${money(s.openingCash)}</dd></div><div><dt>Накопленный остаток</dt><dd>${money(s.cashBalanceAsOf)}</dd></div><div><dt>К выплате сотрудникам</dt><dd>${money(s.employeeOutstanding)}</dd></div><div><dt>Резерв обязательств</dt><dd>${money(s.obligationsReserve)}</dd></div><div class="f-total"><dt>Свободно после выплат</dt><dd>${money(s.freeCashAfterObligations)}</dd></div></dl><p class="muted">Резерв по сотруднику — максимум долга и запланированных выплат. План не вычитается второй раз. Остаток рассчитан только по внесённым данным, без банковской сверки.</p></section>
</details>
  `:financeTab==='attention'?`<p class="muted">${esc(s.period.label)} · по ${esc(s.asOf)}</p><section class="card section"><h2>Выручка и оплата записей</h2><dl class="f-ledger"><div><dt>Заработано за период</dt><dd>${money(s.revenue)}</dd></div><div><dt>Получено по этим записям</dt><dd>${money(s.receivedForCompleted)}</dd></div><div><dt>Ещё не получено</dt><dd>${money(s.unpaidRevenue)}</dd></div></dl><p class="muted">Оплаты связаны через ID записи. Предоплата прошлого периода погашает долг; отдельные платежи входят в «Поступило», но не в выручку. Переплата показывается в предупреждениях.</p><h3>Состояние финансов: <span class="f-health" data-health="${s.health}">${s.health}</span></h3><p class="muted">Отрицательный свободный остаток или критические ошибки — риск. Более 80% лимита расходов или другие предупреждения требуют внимания.</p></section>
<section class="card section"><h2>Замечания и действия</h2>${financeWarningsHtml(s.warnings)}</section>`:`
  <p class="f-notice">План и прогноз относятся к текущему месяцу. Прогноз — возможный результат, а не деньги на счёте.</p>
  <div class="f-grid"><section class="card section"><h2>План / факт текущего месяца</h2><dl class="f-ledger"><div><dt>План выручки</dt><dd>${p.revenueTarget?money(p.revenueTarget):'Не задан'}</dd></div><div><dt>Факт выручки</dt><dd>${money(p.revenueActual)}</dd></div><div><dt>Выполнение</dt><dd>${p.revenuePercent===null?'—':p.revenuePercent+'%'}</dd></div><div><dt>Осталось до плана</dt><dd>${money(p.revenueRemaining)}</dd></div><div><dt>Лимит расходов</dt><dd>${p.expenseLimit?money(p.expenseLimit):'Не задан'}</dd></div><div><dt>Факт расходов</dt><dd>${money(p.expenseActual)}</dd></div><div><dt>Остаток лимита</dt><dd>${p.expenseRemaining===null?'—':money(p.expenseRemaining)}</dd></div></dl><details><summary>Изменить план и лимит</summary><form id="financePlanForm" class="form-grid"><div class="field"><label for="f-target">План выручки, ₽</label><input id="f-target" name="monthlyRevenueTarget" type="number" min="0" step="0.01" required value="${p.revenueTarget}"></div><div class="field"><label for="f-limit">Лимит расходов, ₽</label><input id="f-limit" name="monthlyExpenseLimit" type="number" min="0" step="0.01" required value="${p.expenseLimit}"></div><p class="muted full">0 — план или лимит не задан. Значения используются для текущего месяца; история месячных планов не ведётся.</p><button type="submit" class="btn">Сохранить план</button></form></details></section>
<section class="card section"><h2>Прогноз текущего месяца</h2><dl class="f-ledger"><div><dt>Выручка</dt><dd>${money(s.forecastRevenue)}</dd></div><div><dt>Расходы</dt><dd>${money(s.forecastExpenses)}</dd></div><div><dt>Выплаты</dt><dd>${money(s.forecastPayouts)}</dd></div><div class="f-total"><dt>Свободный остаток</dt><dd>${money(s.forecastFreeCash)}</dd></div></dl><p class="muted">Прогноз основан на текущих данных CRM.</p><p class="muted">Завершённые и будущие подтверждённые записи текущего месяца; оплаченные и регулярные расходы; долги, будущие начисления и план выплат. Предполагается получение недоплаты по завершённым записям и остатка оплаты будущих сессий. Это сценарий, а не обещание поступлений.</p><p class="muted">Ежемесячные расходы в прогнозе: ${s.projectedExpenses.map(e=>esc(e.title)).join(', ') || 'уже учтены или не заданы'}.</p></section></div><details class="f-details"><summary>Разобрать результаты по услугам, сотрудникам и расходам · ${esc(s.period.label)}</summary><div class="f-grid"><section class="card section"><h2>Расходы по категориям</h2>${financeBars(s.expenseCategories)}<p>Крупнейшая категория: ${esc(s.expenseCategories[0]?.name || '—')}</p><p>Крупнейший расход: ${esc(s.largestExpense?.title || '—')}${s.largestExpense?' · '+money(s.largestExpense.amount):''}</p></section><section class="card section"><h2>Выручка по услугам</h2>${financeBars(s.serviceRevenue)}</section><section class="card section"><h2>Выручка по сотрудникам</h2>${financeBars(s.employeeRevenue)}</section><section class="card section"><h2>Записи и клиенты</h2><p>Завершено записей: ${s.completedBookings}</p><p>Средний чек: ${money(s.averageCheck)}</p><p>Топ-услуга: ${esc(s.topService?.name || '—')}</p><p>Топ-клиент: ${esc(s.topClient?.name || '—')}</p></section></div></details>`}
  </div>`;
};
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-finance-tab]');
  if(!button||!canViewFinance())return;
  const next=button.dataset.financeTab;
  if(!['money','attention','planning'].includes(next))return;
  financeTab=next;render();
  document.querySelector('[data-finance-tab="'+next+'"]')?.focus();
});
function filteredExpenses() {
  const period=KrugFinance.periodRange(financePeriod),search=expenseSearch.trim().toLowerCase();
  return state.expenses.filter(e=>e.date>=period.start && e.date<=period.end && (!expenseCategoryFilter || e.category===expenseCategoryFilter) && (!expenseRecurringFilter || e.recurring===(expenseRecurringFilter==='yes')) && (!search || `${e.title} ${e.comment} ${e.category}`.toLowerCase().includes(search))).sort((a,b)=>b.date.localeCompare(a.date));
}
function refreshExpenseList() {
  const list=document.querySelector("#financeExpenseList");if(!list)return;
  list.innerHTML=expenseListHtml();
  const table=list.querySelector("table");if(!table)return;
  table.classList.add("f-mobile-ledger");
  const labels=[...table.querySelectorAll("th")].map(th=>th.textContent);
  table.querySelectorAll("tbody tr").forEach(row=>[...row.children].forEach((cell,i)=>{cell.dataset.label=labels[i]||"";}));
}
function expenseListHtml() {
  const rows=filteredExpenses(),esc=financeEscape;
  return `<p class="muted">Найдено: ${rows.length} · ${money(KrugFinance.sum(rows))}</p>${rows.length?`<div class="table-wrap" role="region" aria-label="Расходы, таблица с прокруткой" tabindex="0"><table><thead><tr><th>Дата</th><th>Расход</th><th>Категория</th><th>Сумма</th><th>Повторение</th><th>Сотрудник</th><th>Действия</th></tr></thead><tbody>${rows.map(e=>`<tr><td>${esc(e.date)}</td><td><strong>${esc(e.title)}</strong><small class="f-comment">${esc(e.comment)}</small></td><td>${esc(e.category)}</td><td>${money(e.amount)}</td><td>${e.recurring?'Ежемесячно':'Разовый'}</td><td>${esc(state.users.find(u=>u.id===e.employeeId)?.name || (e.employeeId?'Сотрудник удалён':'—'))}</td><td><div class="f-row-actions"><button type="button" class="btn secondary" data-expense-edit="${esc(e.id)}">Редактировать</button><button type="button" class="btn danger" data-expense-delete="${esc(e.id)}">Удалить</button></div></td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">Расходов по выбранным фильтрам нет.</p>'}`;
}
function renderExpenses() {
  if(!canManageExpenses())return '<p>Нет доступа к расходам.</p>';
  const esc=financeEscape,e=state.expenses.find(e=>e.id===expenseEditingId) || {};
  return `<div class="finance-v2"><header class="f-toolbar"><div><h2>Расходы студии</h2><p class="muted">Оплаченные затраты, отдельно от выплат сотрудникам</p></div><button type="button" class="btn" data-expense-new>Добавить расход</button>${canViewFinance()?'<button type="button" class="btn secondary" data-view="finance">Финансовый обзор</button>':''}</header>${financeFeedback?`<p role="status" class="f-feedback">${esc(financeFeedback)}</p>`:''}
  ${expenseFormOpen?`<section class="card section" id="expenseEditor"><h2>${expenseEditingId?'Редактировать расход':'Новый расход'}</h2><form id="financeExpenseForm" class="form-grid"><div class="field"><label for="e-date">Дата оплаты</label><input id="e-date" name="date" type="date" required max="${KrugFinance.key(new Date())}" value="${esc(e.date || KrugFinance.key(new Date()))}"></div><div class="field"><label for="e-category">Категория</label><select id="e-category" name="category">${KrugFinance.categories.map(c=>`<option ${e.category===c?'selected':''}>${c}</option>`).join('')}</select></div><div class="field"><label for="e-title">Название расхода</label><input id="e-title" name="title" required maxlength="200" value="${esc(e.title || '')}" placeholder="Например, аренда студии"></div><div class="field"><label for="e-amount">Сумма, ₽</label><input id="e-amount" name="amount" type="number" min="0.01" step="0.01" required value="${e.amount ?? ''}"></div><div class="field"><label for="e-employee">Связанный сотрудник</label><select id="e-employee" name="employeeId"><option value="">Не связан с сотрудником</option>${state.users.map(u=>`<option value="${esc(u.id)}" ${e.employeeId===u.id?'selected':''}>${esc(u.name)}</option>`).join('')}</select></div><label class="f-check"><input name="recurring" type="checkbox" ${e.recurring?'checked':''}> Ежемесячный расход</label><div class="field full"><label for="e-comment">Комментарий</label><textarea id="e-comment" name="comment">${esc(e.comment || '')}</textarea></div><p class="muted full">Ежемесячный расход прогнозируется по категории, названию и сотруднику. Фактическое списание каждый месяц нужно внести вручную. Это не банковский перевод.</p><p id="expenseError" class="f-error full" role="alert"></p><div class="f-row-actions full"><button type="submit" class="btn">Сохранить расход</button><button type="button" class="btn secondary" data-expense-close>Отмена</button></div></form></section>`:''}
  <section class="card section"><details class="f-details"><summary>Поиск и фильтры · ${esc(KrugFinance.periods[financePeriod] || 'Выбранный период')}</summary><div class="f-filters">${financePeriodControl()}<label>Категория расхода<select data-expense-category><option value="">Все категории</option>${KrugFinance.categories.map(c=>`<option ${expenseCategoryFilter===c?'selected':''}>${c}</option>`).join('')}</select></label><label>Повторение<select data-expense-recurring><option value="">Все расходы</option><option value="yes" ${expenseRecurringFilter==='yes'?'selected':''}>Ежемесячные</option><option value="no" ${expenseRecurringFilter==='no'?'selected':''}>Разовые</option></select></label><label>Поиск расходов<input data-expense-search value="${esc(expenseSearch)}" placeholder="Название, категория, комментарий"></label></div></details><div id="financeExpenseList">${expenseListHtml()}</div></section></div>`;
}
document.addEventListener('click',event=>{
  const b=event.target.closest('button');if(!b)return;
  if(b.hasAttribute('data-finance-apply')&&canManageExpenses()){
    const control=b.closest('.f-date-range'),start=control.querySelector('[data-finance-from]').value,end=control.querySelector('[data-finance-to]').value;
    if(!KrugFinance.validDate(start)||!KrugFinance.validDate(end)||start>end){control.querySelector('[data-finance-date-error]').textContent='Выберите обе даты. Начало периода не должно быть позже окончания.';return;}
    financePeriod={start,end};render();return;
  }
  if(b.hasAttribute('data-expense-new')&&canManageExpenses()){expenseEditingId=null;expenseFormOpen=true;financeFeedback='';render();document.querySelector('#e-title')?.focus();}
  if(b.hasAttribute('data-expense-close')){expenseFormOpen=false;expenseEditingId=null;render();}
  if(b.dataset.expenseEdit&&canManageExpenses()){if(!state.expenses.some(e=>e.id===b.dataset.expenseEdit))return;view='expenses';expenseEditingId=b.dataset.expenseEdit;expenseFormOpen=true;financeFeedback='';render();document.querySelector('#e-title')?.focus();}
  if(b.dataset.expenseDelete&&deleteExpense(b.dataset.expenseDelete)){if(expenseEditingId===b.dataset.expenseDelete){expenseFormOpen=false;expenseEditingId=null;}financeFeedback='Расход удалён. Финансовые итоги обновлены.';render();}
});
document.addEventListener('change',event=>{
  const el=event.target;if(!canManageExpenses())return;
  if(el.hasAttribute('data-finance-period')){financePeriod=el.value;render();}
  if(el.hasAttribute('data-expense-category')){expenseCategoryFilter=el.value;refreshExpenseList();}
  if(el.hasAttribute('data-expense-recurring')){expenseRecurringFilter=el.value;refreshExpenseList();}
});
document.addEventListener('input',event=>{if(event.target.hasAttribute('data-expense-search')&&canManageExpenses()){expenseSearch=event.target.value;refreshExpenseList();}});
document.addEventListener('submit',event=>{
  const id=event.target.getAttribute('id');if(!['financeExpenseForm','financePlanForm'].includes(id))return;event.preventDefault();
  const data=Object.fromEntries(new FormData(event.target));
  if(id==='financeExpenseForm'){const result=saveExpense(data,expenseEditingId || '');if(!result.ok){document.querySelector('#expenseError').textContent=result.error;return;}expenseFormOpen=false;expenseEditingId=null;financeFeedback='Расход сохранён. Финансовые итоги обновлены.';render();}
  if(id==='financePlanForm'){if(!saveFinancePlan(data)){financeFeedback='Не удалось сохранить план. Проверьте права и суммы.';}else financeFeedback='План и лимит сохранены.';render();}
});
