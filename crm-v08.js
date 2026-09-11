(() => {
  'use strict';

  const esc08 = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function injectV08Styles() {
    if (document.getElementById('krug-v08-style')) return;
    const style = document.createElement('style');
    style.id = 'krug-v08-style';
    style.textContent = `
      /* 0.8 — responsive cleanup */
      .content{overflow-x:hidden!important}
      .calendar-page,.calendar-workspace,.calendar-workspace>*{min-width:0!important;max-width:100%}
      .calendar-toolbar{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;align-items:center!important;gap:14px!important;width:100%!important}
      .calendar-toolbar>div:first-child{min-width:0}.calendar-toolbar h2{font-size:18px!important;line-height:1.15!important;overflow-wrap:anywhere}
      .calendar-toolbar .actions{display:flex!important;justify-content:flex-end!important;flex-wrap:wrap!important;gap:6px!important;min-width:0}
      .calendar-toolbar .actions>.btn{white-space:nowrap!important}
      .calendar-filters{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:7px!important;width:100%!important}
      .calendar-filters select,.calendar-filters .btn{width:100%!important;max-width:none!important;min-width:0!important}
      .calendar-workspace{grid-template-columns:minmax(0,1fr) minmax(270px,310px)!important;gap:12px!important}
      .calendar-grid{max-width:100%!important;width:100%!important;overflow:auto!important;overscroll-behavior-inline:contain}
      .calendar-day-summary{max-width:100%!important;overflow-x:auto!important}
      .calendar-day-summary article{min-width:110px!important}
      .calendar-availability-summary{max-width:100%!important;overflow:hidden}

      .crm-filterbar{grid-template-columns:minmax(180px,1.45fr) 140px minmax(120px,.8fr) minmax(130px,.9fr) minmax(140px,1fr)!important}
      .crm-client-filterbar{grid-template-columns:minmax(200px,1fr) minmax(150px,180px) minmax(170px,210px)!important;align-items:end!important}
      .crm-clean-section{min-width:0!important;overflow:hidden}
      .crm-booking-list,.crm-client-list{min-width:0}

      /* Finance should read like a workspace, not a wall of cards. */
      .finance-v2{display:grid!important;gap:12px!important}
      .finance-v2 .card.section{padding:15px 16px!important;border-radius:10px!important}
      .finance-v2 .f-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important}
      .finance-v2 .f-grid>.card{min-height:0!important}
      .finance-v2 .f-grid h2{font-size:14px!important;margin-bottom:8px!important}
      .finance-v2 .f-actions{display:flex!important;flex-wrap:wrap!important;gap:6px!important}
      .finance-v2 .f-actions .btn{min-height:34px!important}
      .finance-v2 .f-kpis{gap:0!important;border:1px solid #27292c!important;border-radius:10px!important;overflow:hidden!important;background:#131415!important}
      .finance-v2 .f-metric{border:0!important;border-right:1px solid #27292c!important;border-radius:0!important;background:transparent!important;padding:12px 14px!important}
      .finance-v2 .f-metric:last-child{border-right:0!important}
      .finance-v2 .f-metric strong{font-size:18px!important}
      .finance-v2 .f-metric small{font-size:9px!important;color:#70757b!important}

      .krug-finance-trend{background:#131415;border:1px solid #27292c;border-radius:10px;padding:15px 16px;overflow:hidden}
      .krug-trend-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:12px}
      .krug-trend-head h2{margin:0 0 3px;font-size:15px}.krug-trend-head p{margin:0;color:#747980;font-size:10px}
      .krug-trend-totals{display:flex;gap:16px;flex-wrap:wrap;justify-content:flex-end}
      .krug-trend-totals span{display:grid;gap:2px;text-align:right;color:#73787e;font-size:8px;text-transform:uppercase;letter-spacing:.07em}.krug-trend-totals strong{color:#e8e8e5;font-size:11px;letter-spacing:0;text-transform:none}
      .krug-trend-legend{display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin:0 0 9px;color:#8b9096;font-size:9px}
      .krug-trend-legend span{display:inline-flex;align-items:center;gap:6px}.krug-trend-legend i{display:block;width:12px;height:3px;border-radius:2px;background:#ff6b22}.krug-trend-legend .expense i{background:#7f858c}.krug-trend-legend .bookings i{height:2px;background:#f2f1ed}
      .krug-trend-scroll{overflow-x:auto;overflow-y:hidden;border-top:1px solid #202225;padding-top:8px;scrollbar-width:thin}
      .krug-trend-svg{display:block;height:238px;min-width:100%}
      .krug-trend-grid{stroke:#24272a;stroke-width:1}.krug-trend-axis{fill:#62676e;font-size:8px}.krug-trend-income{fill:#ff6b22}.krug-trend-expense{fill:#777d84}.krug-trend-line{fill:none;stroke:#efefeb;stroke-width:1.8;vector-effect:non-scaling-stroke}.krug-trend-point{fill:#efefeb;stroke:#131415;stroke-width:1.5}
      .krug-trend-empty{display:grid;place-items:center;min-height:150px;color:#777d84;font-size:11px;border-top:1px solid #202225}
      .krug-trend-note{margin:8px 0 0!important;color:#666c73!important;font-size:9px!important}

      /* Reports: no giant empty tiles. */
      .krug-reports{max-width:1420px;margin:0 auto;display:grid;gap:12px}
      .krug-reports-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;padding:2px}
      .krug-reports-head h2{margin:0 0 3px;font-size:17px}.krug-reports-head p{margin:0;color:#747980;font-size:10px}
      .krug-reports-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
      .krug-report-panel{min-width:0;background:#141516;border:1px solid #27292c;border-radius:10px;padding:14px}
      .krug-report-panel h3{font-size:12px;margin:0 0 10px}.krug-report-panel .list{gap:0}.krug-report-panel .list-item{padding:8px 0!important;border:0!important;border-bottom:1px solid #232629!important;background:transparent!important}
      .krug-report-panel .bar-row{grid-template-columns:minmax(90px,1fr) minmax(80px,1.2fr) auto!important;gap:8px!important;padding:7px 0!important}
      .krug-reports-empty{background:#141516;border:1px solid #27292c;border-radius:10px;padding:26px;display:grid;gap:5px}.krug-reports-empty strong{font-size:14px}.krug-reports-empty span{color:#747980;font-size:10px}

      /* Settings: categories are rows, not giant cards. */
      .krug-service-settings{display:grid;grid-template-columns:minmax(270px,.55fr) minmax(0,1.45fr);gap:14px;align-items:start}
      .krug-settings-panel{min-width:0;background:#141516;border:1px solid #27292c;border-radius:10px;padding:14px}
      .krug-settings-panel-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px}.krug-settings-panel-head h2{font-size:14px;margin:0}.krug-settings-panel-head small{color:#6f747b;font-size:9px}
      .krug-category-list{display:grid;border-top:1px solid #25272a}.krug-category-row{display:grid;grid-template-columns:minmax(0,1fr) 70px auto;gap:7px;align-items:center;padding:8px 0;border-bottom:1px solid #25272a;background:transparent!important}.krug-category-row input{height:34px!important;min-height:34px!important;padding:0 9px!important;font-size:11px!important}.krug-category-actions{display:flex;gap:4px}.krug-category-actions .icon-btn{width:32px!important;height:32px!important}
      .krug-add-details{border:1px solid #292c2f;border-radius:8px;background:#111214;margin-bottom:10px}.krug-add-details>summary{padding:9px 11px!important;font-size:10px!important;color:#a6abb1!important}.krug-add-details[open]{padding-bottom:10px}.krug-add-details form{padding:0 10px}.krug-add-details .form-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}.krug-add-details .btn.full{grid-column:1/-1}
      .krug-service-groups{display:grid;gap:8px}.krug-service-group{border:1px solid #27292c;border-radius:9px;background:#121314;overflow:hidden}.krug-service-group>summary{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px!important;list-style:none;font-size:11px!important}.krug-service-group>summary::-webkit-details-marker{display:none}.krug-service-group>summary span{color:#70757b;font-size:9px}.krug-service-group[open]>summary{border-bottom:1px solid #27292c;margin:0!important}.krug-service-group .list{padding:7px 10px 10px}.krug-service-group .service-edit-row{display:grid!important;grid-template-columns:minmax(150px,1.5fr) minmax(120px,1fr) 90px 100px 64px auto auto!important;gap:6px!important;align-items:center!important;padding:7px 0!important;border:0!important;border-bottom:1px solid #222528!important;background:transparent!important}.krug-service-group .service-edit-row:last-child{border-bottom:0!important}.krug-service-group .service-edit-row input,.krug-service-group .service-edit-row select{height:32px!important;min-height:32px!important;padding:0 8px!important;font-size:10px!important}.krug-service-group .mini-check{font-size:9px!important;white-space:nowrap}.krug-service-group .icon-btn{width:30px!important;height:30px!important}

      @media(max-width:1280px){
        .calendar-toolbar{grid-template-columns:1fr!important;align-items:start!important}.calendar-toolbar .actions{justify-content:flex-start!important}.calendar-workspace{grid-template-columns:1fr!important}.krug-booking-inspector{position:static!important}.calendar-filters{grid-template-columns:repeat(3,minmax(0,1fr))!important}
        .crm-filterbar{grid-template-columns:minmax(180px,1fr) 140px repeat(3,minmax(120px,1fr))!important}
        .krug-reports-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.krug-service-settings{grid-template-columns:1fr}.krug-service-group .service-edit-row{grid-template-columns:minmax(160px,1.5fr) minmax(120px,1fr) 90px 100px 64px auto auto!important}
      }
      @media(max-width:1050px){
        .crm-filterbar{grid-template-columns:1fr 150px 1fr!important}.crm-filterbar>select:nth-of-type(2),.crm-filterbar>select:nth-of-type(3){grid-column:auto}.crm-client-filterbar{grid-template-columns:minmax(0,1fr) 160px!important}.crm-client-filterbar>select:last-child{grid-column:1/-1}
        .finance-v2 .f-grid{grid-template-columns:1fr!important}.krug-reports-grid{grid-template-columns:1fr}.krug-service-group .service-edit-row{grid-template-columns:1fr 1fr 90px 100px!important}.krug-service-group .service-edit-row>.mini-check,.krug-service-group .service-edit-row>.icon-btn{grid-row:auto}
      }
      @media(max-width:760px){
        .calendar-filters{grid-template-columns:1fr!important}.calendar-day-summary article{min-width:96px!important}.crm-filterbar,.crm-client-filterbar{grid-template-columns:1fr!important}.crm-filterbar>* ,.crm-client-filterbar>*{grid-column:1!important}.krug-trend-head{display:grid}.krug-trend-totals{justify-content:flex-start}.krug-settings-panel{padding:12px}.krug-add-details .form-grid,.krug-service-group .service-edit-row{grid-template-columns:1fr!important}.krug-category-row{grid-template-columns:1fr 64px auto}.finance-v2 .f-kpis{display:grid!important;grid-template-columns:1fr!important}.finance-v2 .f-metric{border-right:0!important;border-bottom:1px solid #27292c!important}
      }
    `;
    document.head.appendChild(style);
  }

  function shortDate08(value) {
    const [,m,d] = String(value).split('-');
    return d && m ? `${d}.${m}` : value;
  }

  function dateRangeDays08(start, end) {
    const rows = [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return rows;
    let cursor = new Date(`${start}T12:00:00`);
    const finish = new Date(`${end}T12:00:00`);
    let guard = 0;
    while (cursor <= finish && guard < 366) {
      rows.push(`${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,'0')}-${String(cursor.getDate()).padStart(2,'0')}`);
      cursor.setDate(cursor.getDate()+1);
      guard += 1;
    }
    return rows;
  }

  function financeTrendData08() {
    const today = todayKey();
    let range = KrugFinance.periodRange(financePeriod, new Date());
    let start = range.start;
    let end = range.end > today ? today : range.end;
    if (start === '0001-01-01') {
      const d = new Date(`${end}T12:00:00`);
      d.setDate(d.getDate()-29);
      start = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      range = {...range,label:'Последние 30 дней'};
    }
    const days = dateRangeDays08(start,end);
    const paymentByDate = new Map();
    const expenseByDate = new Map();
    const bookingsByDate = new Map();
    (state.payments||[]).forEach(row => paymentByDate.set(String(row.date||'').slice(0,10),(paymentByDate.get(String(row.date||'').slice(0,10))||0)+Number(row.amount||0)));
    (state.expenses||[]).forEach(row => expenseByDate.set(String(row.date||'').slice(0,10),(expenseByDate.get(String(row.date||'').slice(0,10))||0)+Number(row.amount||0)));
    (state.bookings||[]).filter(row=>row.status!=='отменено').forEach(row => bookingsByDate.set(String(row.date||'').slice(0,10),(bookingsByDate.get(String(row.date||'').slice(0,10))||0)+1));
    const rows = days.map(date => ({date,income:paymentByDate.get(date)||0,expense:expenseByDate.get(date)||0,bookings:bookingsByDate.get(date)||0}));
    return {range:{...range,start,end},rows};
  }

  function renderFinanceTrend08() {
    const {range,rows} = financeTrendData08();
    const totals = rows.reduce((acc,row)=>({income:acc.income+row.income,expense:acc.expense+row.expense,bookings:acc.bookings+row.bookings}),{income:0,expense:0,bookings:0});
    const hasData = rows.some(row=>row.income||row.expense||row.bookings);
    const periodText = `${shortDate08(range.start)} — ${shortDate08(range.end)}`;
    if (!rows.length) return '';
    if (!hasData) return `<section class="krug-finance-trend"><div class="krug-trend-head"><div><h2>Динамика студии</h2><p>${esc08(range.label)} · ${esc08(periodText)}</p></div><div class="krug-trend-totals"><span>Записей<strong>0</strong></span><span>Доход<strong>0 ₽</strong></span><span>Расход<strong>0 ₽</strong></span></div></div><div class="krug-trend-legend"><span><i></i>доход</span><span class="expense"><i></i>расход</span><span class="bookings"><i></i>количество записей</span></div><div class="krug-trend-empty">Данные появятся после первых записей и финансовых операций.</div><p class="krug-trend-note">График использует тот же период, что выбран выше. Расходы — только внесённые расходы студии, без выплат сотрудникам.</p></section>`;

    const width = Math.max(760, rows.length * 34 + 76);
    const height = 228, left = 44, right = 28, top = 14, bottom = 38;
    const chartH = height-top-bottom, innerW = width-left-right;
    const moneyMax = Math.max(1,...rows.flatMap(row=>[row.income,row.expense]));
    const bookingMax = Math.max(1,...rows.map(row=>row.bookings));
    const step = innerW / rows.length;
    const barW = Math.min(9,Math.max(4,step*.22));
    const grid = Array.from({length:4},(_,i)=>{
      const ratio=i/3, y=top+chartH*ratio, value=Math.round(moneyMax*(1-ratio));
      return `<line class="krug-trend-grid" x1="${left}" x2="${width-right}" y1="${y}" y2="${y}"/><text class="krug-trend-axis" x="2" y="${y+3}">${value>=1000?`${Math.round(value/1000)}k`:value}</text>`;
    }).join('');
    const labelEvery = rows.length<=10?1:rows.length<=20?2:rows.length<=40?4:7;
    const bars = rows.map((row,index)=>{
      const cx=left+step*(index+.5);
      const incomeH=chartH*(row.income/moneyMax), expenseH=chartH*(row.expense/moneyMax);
      const label=index%labelEvery===0||index===rows.length-1?`<text class="krug-trend-axis" text-anchor="middle" x="${cx}" y="${height-12}">${shortDate08(row.date)}</text>`:'';
      return `<g><rect class="krug-trend-income" x="${cx-barW-1}" y="${top+chartH-incomeH}" width="${barW}" height="${incomeH}" rx="2"><title>${row.date}: доход ${money(row.income)}</title></rect><rect class="krug-trend-expense" x="${cx+1}" y="${top+chartH-expenseH}" width="${barW}" height="${expenseH}" rx="2"><title>${row.date}: расход ${money(row.expense)}</title></rect>${label}</g>`;
    }).join('');
    const points=rows.map((row,index)=>{const x=left+step*(index+.5),y=top+chartH-(chartH*(row.bookings/bookingMax));return [x,y,row];});
    const line=`<polyline class="krug-trend-line" points="${points.map(([x,y])=>`${x},${y}`).join(' ')}"/>${points.map(([x,y,row])=>`<circle class="krug-trend-point" cx="${x}" cy="${y}" r="3"><title>${row.date}: записей ${row.bookings}</title></circle>`).join('')}`;
    return `<section class="krug-finance-trend"><div class="krug-trend-head"><div><h2>Динамика студии</h2><p>${esc08(range.label)} · ${esc08(periodText)}</p></div><div class="krug-trend-totals"><span>Записей<strong>${totals.bookings}</strong></span><span>Доход<strong>${money(totals.income)}</strong></span><span>Расход<strong>${money(totals.expense)}</strong></span></div></div><div class="krug-trend-legend"><span><i></i>доход</span><span class="expense"><i></i>расход</span><span class="bookings"><i></i>количество записей</span></div><div class="krug-trend-scroll"><svg class="krug-trend-svg" viewBox="0 0 ${width} ${height}" width="${width}" role="img" aria-label="Динамика записей, доходов и расходов по дням">${grid}${bars}${line}</svg></div><p class="krug-trend-note">Белая линия использует собственную шкалу количества записей; столбцы — рубли. Период синхронизирован с фильтром выше.</p></section>`;
  }

  if (typeof renderFinanceDashboard === 'function') {
    const renderFinanceDashboardBase08 = renderFinanceDashboard;
    renderFinanceDashboard = function renderFinanceDashboardV08() {
      const html = renderFinanceDashboardBase08();
      if (financeTab !== 'money') return html;
      const marker = '<section class="card section"><h2>Что хотите сделать?</h2>';
      return html.includes(marker) ? html.replace(marker, `${renderFinanceTrend08()}${marker}`) : `${html}${renderFinanceTrend08()}`;
    };
  }

  renderReports = function renderReportsV08() {
    const payments = state.payments || [];
    const payouts = state.payouts || [];
    if (!payments.length && !payouts.length) return `<section class="krug-reports"><header class="krug-reports-head"><div><h2>Отчёты</h2><p>Сводки появятся после первых операций.</p></div></header><div class="krug-reports-empty"><strong>Пока нечего анализировать</strong><span>После первых оплат и выплат здесь появятся компактные срезы по времени, клиентам и команде.</span></div></section>`;
    const byWeek = sortedEntries(groupSum(payments,item=>periodKey(item.date,'week')));
    const byMonth = sortedEntries(groupSum(payments,item=>periodKey(item.date,'month')));
    const byClient = sortedEntries(groupSum(payments,item=>item.client));
    const byEmployee = sortedEntries(groupSum(payments,item=>paymentTeamLabel(item)||'не указан'));
    const paidPayouts = payouts.filter(item=>item.status==='Выплачено');
    const payoutByRecipient = sortedEntries(groupSum(paidPayouts,item=>item.recipient));
    return `<section class="krug-reports"><header class="krug-reports-head"><div><h2>Отчёты</h2><p>Короткие срезы без дублирования финансового обзора.</p></div></header><div class="krug-reports-grid"><section class="krug-report-panel"><h3>По неделям</h3>${renderList(byWeek.slice(0,8))}</section><section class="krug-report-panel"><h3>По месяцам</h3>${renderList(byMonth.slice(0,8))}</section><section class="krug-report-panel"><h3>Клиенты по сумме оплат</h3>${renderBars(byClient.slice(0,8))}</section><section class="krug-report-panel"><h3>Доход по команде</h3>${renderBars(byEmployee.slice(0,8))}</section><section class="krug-report-panel"><h3>Выплаты по получателям</h3>${renderBars(payoutByRecipient.slice(0,8))}</section></div></section>`;
  };

  renderServiceGroupBlock = function renderServiceGroupBlockV08(group) {
    const services = catalogServices().filter(service=>service.categoryId===group.id);
    return `<details class="krug-service-group"><summary><strong>${esc08(group.name)}</strong><span>${services.length} ${plural(services.length,'услуга','услуги','услуг')}</span></summary><div class="list">${services.map(service=>service.pricingType==='hourly'?renderHourlyServiceRow(service):`<form class="service-edit-row" data-service-item-row="${service.id}"><input name="name" value="${esc08(service.name)}" aria-label="Название услуги"/><select name="categoryId" aria-label="Категория">${catalogGroups().map(item=>`<option value="${item.id}" ${service.categoryId===item.id?'selected':''}>${esc08(item.name)}</option>`).join('')}</select><input name="price" type="number" min="0" step="1" value="${service.price}" aria-label="Стоимость"/><input name="duration" value="${esc08(service.duration)}" aria-label="Длительность"/><input name="order" type="number" min="1" step="1" value="${service.order}" aria-label="Порядок"/><label class="mini-check"><input name="active" type="checkbox" ${service.active!==false?'checked':''}/> активна</label><button class="icon-btn" title="Сохранить" data-save-service-item="${service.id}" type="button">✓</button><button class="icon-btn danger-icon" title="Удалить" data-delete-service-item="${service.id}" type="button">×</button></form>`).join('')||'<p class="muted">В этой категории пока нет услуг.</p>'}</div></details>`;
  };

  renderServiceSettings = function renderServiceSettingsV08() {
    const groups = catalogGroups();
    return `<div class="krug-service-settings"><section class="krug-settings-panel"><div class="krug-settings-panel-head"><h2>Категории</h2><small>${groups.length}</small></div><details class="krug-add-details"><summary>+ Добавить категорию</summary><form id="serviceGroupForm" class="form-grid"><div class="field"><label>Название</label><input name="name" required placeholder="Например: Запись"/></div><div class="field"><label>Порядок</label><input name="order" type="number" min="1" step="1" value="${groups.length+1}"/></div><button class="btn full" type="submit">Создать категорию</button></form></details><div class="krug-category-list">${groups.map(group=>`<form class="krug-category-row" data-service-group-row="${group.id}"><input name="name" value="${esc08(group.name)}" aria-label="Название категории"/><input name="order" type="number" min="1" step="1" value="${group.order}" aria-label="Порядок"/><span class="krug-category-actions"><button class="icon-btn" title="Сохранить" data-save-service-group="${group.id}" type="button">✓</button><button class="icon-btn danger-icon" title="Удалить" data-delete-service-group="${group.id}" type="button">×</button></span></form>`).join('')}</div></section><section class="krug-settings-panel"><div class="krug-settings-panel-head"><h2>Услуги</h2><small>${catalogServices().length}</small></div><details class="krug-add-details"><summary>+ Добавить услугу</summary><form id="serviceItemForm" class="form-grid"><div class="field"><label>Название</label><input name="name" required placeholder="Запись 1 час"/></div><div class="field"><label>Категория</label><select name="categoryId">${groups.map(group=>`<option value="${group.id}">${esc08(group.name)}</option>`).join('')}</select></div><div class="field"><label>Стоимость</label><input name="price" type="number" min="0" step="1" value="0"/></div><div class="field"><label>Длительность</label><input name="duration" value="1 час"/></div><div class="field"><label>Порядок</label><input name="order" type="number" min="1" step="1" value="${catalogServices().length+1}"/></div><button class="btn" type="submit">Создать услугу</button></form></details><div class="krug-service-groups">${groups.map(renderServiceGroupBlock).join('')}</div></section></div>`;
  };

  /* Remove the duplicate content-level create button from the bookings list; sidebar/top-level create remains. */
  const renderBookingsBase08 = renderBookings;
  renderBookings = function renderBookingsV08() {
    const html = renderBookingsBase08();
    return html.replace(/<div class="crm-section-head"><div><h2>Все записи<\/h2>(.*?)<\/div><button class="btn" type="button" data-action="openBookingModal">\+ Новая запись<\/button><\/div>/s,'<div class="crm-section-head"><div><h2>Все записи</h2>$1</div></div>');
  };

  injectV08Styles();
  try { render(); } catch (error) { console.warn('[KRUG CRM] v0.8 render skipped', error); }
})();
