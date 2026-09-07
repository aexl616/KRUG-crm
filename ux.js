/* Independent presentation layer. Original business logic remains in app.js. */
(() => {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const sections = [
    ['dashboard','Сегодня','Сводка дня и ближайшие сессии','Работа студии','◉'],
    ['calendar','Расписание','Свободное время и занятость студии','Работа студии','▦'],
    ['bookings','Записи','Все сессии, статусы и участники','Работа студии','≡'],
    ['clients','Клиенты','Контакты и история посещений','Работа студии','♙'],
    ['finance','Обзор финансов','Доходы, расходы и результат','Деньги','↗'],
    ['payments','Оплаты клиентов','Поступления за услуги студии','Деньги','↓'],
    ['payouts','Выплаты команде','Начисления и выплаты сотрудникам','Деньги','↑'],
    ['budget','Распределение дохода','Доли студии, копилки и правила','Деньги','◫'],
    ['reports','Отчёты','Результаты по дням, услугам и клиентам','Аналитика и управление','▥'],
    ['settings','Настройки','Услуги, команда и профиль','Аналитика и управление','⚙']
  ];
  const explanations = {
    dashboard: 'Начните с расписания: выберите время, услугу и сотрудника. Здесь появятся ближайшие записи и задачи на сегодня.',
    calendar: 'Нажмите на свободное время, чтобы создать запись. Выберите занятую сессию, чтобы посмотреть её детали. Технический перерыв закрывает время для работы студии.',
    bookings: 'Запись — это сессия клиента в студии. Здесь можно найти её, назначить сотрудника и изменить статус. При завершении система создаёт связанную оплату.',
    clients: 'Клиенты появляются из записей и оплат. Откройте карточку, чтобы увидеть контакты, историю посещений и заметки.',
    finance: 'Это сводка денег студии. Поступления находятся в «Оплатах клиентов», расчёты с сотрудниками — в «Выплатах команде».',
    payments: 'Здесь учитываются поступления клиентов. Завершённая запись создаёт оплату автоматически. Вручную добавляйте только отдельное поступление, чтобы не учитывать деньги дважды.',
    payouts: 'Начислено — сколько заработал сотрудник. Выплачено — что уже выдали. Доступно — остаток для выплаты. Добавление выплаты фиксирует учёт, но не переводит деньги в банке.',
    budget: 'Здесь показано, как доход от услуг распределяется между студией и участниками. Это распределение учётных сумм, а не банковские счета.',
    reports: 'Все учтённые оплаты сгруппированы по дням, неделям и месяцам. Ниже — вклад клиентов и сотрудников, затем история выплат. Фильтра периода в этой версии пока нет.',
    settings: 'Сначала настройте услуги и цены, затем добавьте сотрудников. Эти данные используются при создании каждой записи.'
  };
  let helpOpen = false;
  let lastView = view;
  const navButton = ([key,label,description,,icon], compact=false) => `<button type="button" data-view="${key}" class="${view===key?'active':''}" ${view===key?'aria-current="page"':''} title="${description}"><span class="ux-icon" aria-hidden="true">${icon}</span><span>${label}${compact?'':`<small>${description}</small>`}</span></button>`;
  const available = () => sections.filter(([key]) => canViewSection(key));
  const grouped = () => ['Работа студии','Деньги','Аналитика и управление'].map(group => {
    const items=available().filter(item=>item[3]===group);
    return items.length?`<div class="ux-nav-group"><p>${group}</p>${items.map(item=>navButton(item)).join('')}</div>`:'';
  }).join('');
  pageTitle = () => sections.find(item=>item[0]===view)?.[1] || 'КРУГ';
  pageSubtitle = () => sections.find(item=>item[0]===view)?.[2] || '';
  navButtons = () => available().map(item=>navButton(item,true)).join('');
  keepActiveMobileTabVisible = () => {};
  const oldLogin=renderLogin;
  renderLogin=()=>{oldLogin();const intro=document.querySelector('.login-card > .muted');if(intro)intro.textContent='Записи, клиенты и деньги студии — в одном месте. Войдите, чтобы открыть рабочий день.';const hint=document.querySelector('.login-card .hint');if(hint)hint.textContent='Данные хранятся в этом браузере. Используйте CRM только для внутренней работы студии.';const submit=document.querySelector('#loginForm button[type="submit"]');if(submit)submit.textContent='Открыть рабочее пространство';document.querySelectorAll('#loginForm .field').forEach((field,i)=>{const input=field.querySelector('input'),label=field.querySelector('label');input.id=`ux-login-${i}`;label.htmlFor=input.id;});};
  renderSidebar = () => `<aside class="sidebar ux-sidebar">
    <div class="brand"><img class="brand-mark" src="krug-logo.png" alt="КРУГ"><div><strong>КРУГ</strong><span>Рабочее пространство студии</span></div></div>
    ${canCreateBooking()?'<button type="button" class="btn ux-create" data-action="openBookingModal">+ Новая запись</button>':''}
    <nav class="nav" aria-label="Разделы CRM">${grouped()}</nav>
    <div class="ux-sidebar-footer"><strong>${escape(currentUser().name)}</strong><span>${escape(roleLabel())}</span><div>${!isOwner()?'<button type="button" class="logout" data-action="returnOwner">Режим владельца</button>':''}<button type="button" class="logout" data-action="logout">Выйти из CRM</button></div></div>
  </aside>`;
  renderMobileTabs = () => `<nav class="mobile-tabs" aria-label="Основные разделы">${available().filter(item=>['dashboard','calendar','bookings','clients'].includes(item[0])).map(item=>navButton(item,true)).join('')}<button type="button" data-ux-menu class="${!['dashboard','calendar','bookings','clients'].includes(view)?'active':''}" aria-haspopup="dialog"><span class="ux-icon" aria-hidden="true">☰</span><span>Ещё</span></button></nav>
    <dialog class="ux-menu" aria-label="Все разделы CRM"><div class="ux-menu-head"><h2>Все разделы</h2><button type="button" data-ux-close class="btn secondary">Закрыть</button></div><nav>${grouped()}</nav><button class="logout" data-action="logout">Выйти из CRM</button></dialog>`;
  const oldTopbar = renderTopbar;
  renderTopbar = () => `${oldTopbar()}<div class="ux-page-actions"><span class="ux-breadcrumb">Студия <span aria-hidden="true">/</span> ${pageTitle()}</span><div>${canCreateBooking()?'<button type="button" class="btn ux-mobile-create" data-action="openBookingModal">+ Новая запись</button>':''}<button type="button" class="btn secondary" data-ux-help aria-expanded="${helpOpen}">Как здесь работать</button></div></div><section class="ux-help" ${helpOpen?'':'hidden'}><h2>${pageTitle()}: с чего начать</h2><p>${explanations[view]}</p><ol><li>Создайте запись с клиентом и услугой.</li><li>Проведите сессию и обновите её статус.</li><li>Проверьте связанную оплату и расчёты с командой.</li></ol><p class="muted">Завершение записи отражается в учёте автоматически. Проверяйте сумму и фактическое поступление денег.</p></section>`;
  const oldDashboard = renderDashboard;
  renderDashboard = () => `<section class="ux-start"><div><span class="ux-eyebrow">ВАША СТУДИЯ. ВЕСЬ ДЕНЬ ПОД КОНТРОЛЕМ.</span><h2>Что запланируем сегодня?</h2><p>Найдите свободное время, создайте запись — остальное будет связано с ней.</p></div><div class="ux-start-actions"><button class="btn secondary" type="button" data-view="calendar">Открыть расписание →</button>${canCreateBooking()?'<button class="btn" type="button" data-action="openBookingModal">+ Создать запись</button>':''}</div></section>${oldDashboard()}`;
  const oldSettings = renderSettings;
  renderSettings = () => oldSettings().replace('>Выплаты</button>','>Правила выплат</button>').replace('>Бюджет / копилки</button>','>Правила распределения</button>').replace('>Текущий пользователь</button>','>Проверка ролей</button>');
  const oldPlaceholder = renderSettingsPlaceholder;
  renderSettingsPlaceholder = (title,text) => `${oldPlaceholder(title,({payouts:'Начисления и историю расчётов с сотрудниками можно посмотреть в разделе «Выплаты команде».',budget:'Текущие доли и правила можно посмотреть в разделе «Распределение дохода».',general:'Настройка рабочего времени и уведомлений пока недоступна.'})[settingsTab]||text)}<p class="ux-notice">Этот раздел пока справочный: редактируемых параметров здесь нет.</p>${settingsTab==='payouts'&&canViewSection('payouts')?'<button class="btn secondary" data-view="payouts">Перейти к выплатам команде →</button>':''}${settingsTab==='budget'&&canViewSection('budget')?'<button class="btn secondary" data-view="budget">Посмотреть распределение дохода →</button>':''}`;
  const oldCommands=renderCommandPalette;
  renderCommandPalette=()=>oldCommands().replace('<div class="command-input">','<div class="ux-menu-head"><h2>Быстрый переход</h2><button type="button" class="btn secondary" data-action="closeCommandPalette">Закрыть</button></div><div class="command-input">');

  function enhance() {
    const content=document.querySelector('.content');
    if(!content) return;
    document.body.dataset.section=view;
    if(view==='dashboard'){
      const summary=document.querySelector('.today-summary-section');
      document.querySelector('.studio-home')?.after(summary);
    }
    document.querySelector('[data-ux-help]')?.addEventListener('click',e=>{helpOpen=!helpOpen;document.querySelector('.ux-help').hidden=!helpOpen;e.currentTarget.setAttribute('aria-expanded',String(helpOpen));});
    const menu=document.querySelector('.ux-menu');
    document.querySelector('[data-ux-menu]')?.addEventListener('click',()=>menu.showModal());
    menu?.querySelector('[data-ux-close]')?.addEventListener('click',()=>menu.close());
    menu?.addEventListener('click',e=>{if(e.target===menu){const r=menu.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)menu.close();}});
    const search=document.querySelector('#globalSearch');if(search){search.placeholder='Найти клиента, запись или оплату';search.setAttribute('aria-label','Поиск по CRM');}
    const profile=document.querySelector('.topbar-profile');if(profile){profile.innerHTML='<span aria-hidden="true">⌘</span><strong>Быстрый переход<small>Ctrl + K</small></strong>';profile.title='Найти раздел или действие';profile.setAttribute('aria-label','Быстрый переход: поиск разделов и действий');}
    document.querySelector('[data-action="toggleNotifications"]')?.setAttribute('aria-label', typeof unreadNotificationsCount === 'function' ? `Уведомления: ${unreadNotificationsCount()} непрочитанных` : 'Уведомления студии');
    const words={'Client Intelligence':'Что важно знать о клиенте','Принёс денег':'Всего оплатил','Профиль администратора':'Мой профиль','Звукореж':'Звукорежиссёр','Фикс. ставка':'Фиксированная ставка, ₽','Процент':'Доля сотрудника, %','Выплаты вне копилок':'Начисления сотрудникам','Топ клиентов':'Клиенты по сумме оплат'};
    document.querySelectorAll('h2,h3,.field > label,.client-profile-stats span').forEach(el=>{const key=el.textContent.trim();if(words[key])el.textContent=words[key];});
    document.querySelectorAll('[data-payout-filter-employee]').forEach(b=>{if(b.textContent.trim()==='История')b.textContent='История выплат';});
    document.querySelectorAll('[data-open-employee-bookings]').forEach(b=>b.textContent='Записи сотрудника');
    document.querySelectorAll('[data-open-employee-payout]').forEach(b=>{b.textContent='Учесть выплату';if(b.disabled)b.title='Выплата недоступна: проверьте доступный остаток и предупреждения в карточке.';});
    document.querySelectorAll('button.mini-confirm,button.mini-cancel').forEach(b=>{b.textContent=b.title;b.setAttribute('aria-label',b.title);b.classList.add('ux-text-action');});
    document.querySelectorAll('[data-remove-client-tag]').forEach(b=>b.setAttribute('aria-label',`Удалить тег «${b.dataset.tag}»`));
    document.querySelectorAll('button[data-booking-status],button[data-side-status-booking]').forEach(b=>{const titles={'подтверждено':'Подтвердить запись','в процессе':'Начать сессию','завершено':'Завершить и учесть оплату','отменено':'Отменить запись'};if(titles[b.dataset.status])b.textContent=titles[b.dataset.status];});
    document.querySelectorAll('button[data-view="calendar"]').forEach(b=>{if(b.textContent.trim()==='Календарь')b.textContent='Расписание';if(b.textContent.trim()==='Открыть календарь')b.textContent='Открыть расписание';});
    const filterLabels={bookingDateFilter:'Дата записи',payoutEmployeeFilter:'Сотрудник',payoutPeriodFilter:'Период выплат',payoutStatusFilter:'Статус выплаты',payoutProblemsFilter:'Ошибки в расчётах',calendarEmployeeFilter:'Сотрудник',calendarStatusFilter:'Статус записи',calendarServiceFilter:'Услуга или категория',bookingStatusFilter:'Статус записи',bookingEmployeeFilter:'Сотрудник',bookingServiceFilter:'Услуга',clientStatusFilter:'Статус клиента',clientTagFilter:'Тег клиента',clientSegmentFilter:'Группа клиентов',clientSort:'Порядок сортировки'};
    Object.entries(filterLabels).forEach(([id,text])=>{const el=document.getElementById(id);if(!el)return;el.setAttribute('aria-label',text);if(el.closest('label')||el.closest('.field')?.querySelector('label'))return;const label=document.createElement('label');label.className='ux-filter';label.htmlFor=id;label.textContent=text;el.before(label);label.append(el);});

    const names={client:'Имя клиента',phone:'Телефон',telegram:'Telegram',name:'Название',categoryId:'Категория',price:'Цена, ₽',duration:'Длительность',order:'Порядок в списке',active:'Доступна для новых записей',percent:'Доля, %',fixedRate:'Фиксированная ставка, ₽',employeeId:'Ответственный сотрудник',date:'Дата',time:'Время начала',amount:'Сумма, ₽',status:'Статус записи',comment:'Комментарий'};
    let seq=0;
    document.querySelectorAll('input:not([type="hidden"]),select,textarea').forEach(control=>{
      if(!control.id)control.id=`ux-field-${++seq}`;
      let label=control.closest('.field')?.querySelector('label');
      if(label&&!label.querySelector('input,select'))label.htmlFor=control.id;
      const rawRow=control.closest('.service-edit-row,.settings-row');
      if(rawRow&&!control.closest('label')){
        label=document.createElement('label');label.className='ux-field-label';label.htmlFor=control.id;label.textContent=names[control.name]||control.name;control.before(label);label.append(control);
      }
      if(!label&&!control.closest('label')&&!control.getAttribute('aria-label'))control.setAttribute('aria-label',names[control.name]||control.placeholder||control.id);
      if(control.required&&label&&!label.querySelector('.ux-required')){const mark=document.createElement('span');mark.className='ux-required';mark.textContent=' *';label.prepend(mark);}
      if(control.name==='phone') {control.inputMode='tel';if(!control.placeholder)control.placeholder='+7 999 123-45-67';}
      if(control.name==='client'&&!control.placeholder)control.placeholder='Имя или творческий псевдоним';
      if(control.name==='telegram'&&!control.placeholder)control.placeholder='@username';
    });
    document.querySelectorAll('button.icon-btn').forEach(button=>{
      const action=button.dataset.action||'';
      let title=button.title;
      if(!title&&action.startsWith('close')) title='Закрыть';
      if(!title&&button.textContent.trim()==='×')title='Закрыть';
      if(!title&&button.textContent.trim()==='✎')title='Редактировать';
      if(!title&&button.textContent.trim()==='✓')title='Сохранить';
      if(title){button.setAttribute('aria-label',title);if(!action.startsWith('close')){button.textContent=title;button.classList.add('ux-text-action');}}
    });
    const actionNames={prevCalendarPeriod:'← Предыдущий период',nextCalendarPeriod:'Следующий период →',todayCalendar:'К текущей дате',openStudioBlockModal:'Перерыв / закрыть время',completeBookingFromModal:'Завершить и учесть оплату',cancelBookingFromModal:'Отменить запись',deleteBookingFromModal:'Удалить запись',backToClients:'← К списку клиентов',resetPayoutFilters:'Сбросить фильтры',clearCalendarFilters:'Сбросить фильтры'};
    document.querySelectorAll('button[data-action]').forEach(b=>{if(actionNames[b.dataset.action])b.textContent=actionNames[b.dataset.action];});
    document.querySelectorAll('button[type="submit"]').forEach(b=>{const id=b.closest('form')?.getAttribute('id');const map={bookingModalForm:'Сохранить запись',bookingForm:editingBookingId?'Сохранить запись':'Создать запись',paymentForm:editingPaymentId?'Сохранить оплату':'Добавить оплату',payoutForm:'Сохранить выплату',clientIntelligenceForm:'Сохранить заметки'};if(map[id])b.textContent=map[id];});
    document.querySelectorAll('.table-wrap').forEach(e=>{e.tabIndex=0;e.setAttribute('role','region');e.setAttribute('aria-label','Таблица. Прокрутите вправо, чтобы увидеть все столбцы.');const n=document.createElement('p');n.className='ux-table-hint';n.textContent='↔ Таблицу можно прокрутить вправо';e.before(n);});
    document.querySelectorAll('.calendar-slot').forEach(b=>{const [date,time]=b.dataset.calendarSlot.split('|');b.setAttribute('aria-label',`Создать запись: ${date}, ${time}`);});
    document.querySelectorAll('.calendar-booking').forEach(b=>{b.tabIndex=0;b.setAttribute('role','button');b.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();b.click();}});});
    if(view!=='dashboard'){const p=document.createElement('p');p.className='ux-context';p.textContent=explanations[view];document.querySelector('.ux-help')?.after(p);}
    ['bookingModalForm','bookingForm','paymentForm','studioBlockForm','payoutForm'].forEach(id=>{const form=document.getElementById(id);if(form){const p=document.createElement('p');p.className='ux-form-intro full';p.textContent='Поля со звёздочкой обязательны. Проверьте данные и нажмите кнопку сохранения.';form.prepend(p);}});
    const modalForm=document.querySelector('#bookingModalForm');
    if(modalForm){const note=document.createElement('p');note.className='ux-form-intro full';note.textContent='Статус «Завершено» создаёт связанную оплату. Используйте его после сессии и проверки расчёта с клиентом.';modalForm.querySelector('[name="status"]')?.closest('.field')?.after(note);}
    if(view==='settings'&&settingsTab==='services'){
      document.querySelectorAll('.catalog-group-card').forEach(card=>{const h=card.querySelector('h3'),list=card.querySelector('.list');if(!h||!list)return;const d=document.createElement('details'),s=document.createElement('summary');s.textContent=`${h.textContent} · ${list.children.length} услуг`;d.append(s,list);h.replaceWith(d);});
      document.querySelectorAll('#serviceGroupForm,#serviceItemForm').forEach(form=>{const d=document.createElement('details');d.className='ux-add-form';const s=document.createElement('summary');s.textContent=form.getAttribute('id')==='serviceGroupForm'?'+ Добавить категорию':'+ Добавить услугу';form.before(d);d.append(s,form);});
    }
    if(view==='settings'&&settingsTab==='employees')document.querySelectorAll('.employee-card').forEach(card=>{const head=card.querySelector('.employee-card-head');if(!head)return;const d=document.createElement('details'),s=document.createElement('summary');s.textContent=head.innerText.replace(/\s+/g,' ').trim();const children=[...card.children].filter(e=>e!==head);d.append(s,...children);head.replaceWith(d);});
    document.querySelectorAll('.modal-backdrop > .modal').forEach(m=>{
      m.querySelector('input:not([type="hidden"]),select,button')?.focus({preventScroll:true});
      m.addEventListener('keydown',e=>{
        if(e.key==='Escape'){e.stopPropagation();m.querySelector('[data-action^="close"]')?.click();}
        if(e.key==='Tab'){const items=[...m.querySelectorAll('button,input:not([type="hidden"]),select,textarea,a[href]')].filter(el=>!el.disabled&&el.getClientRects().length);const first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
      });
    });
  }
  const originalRender=render;
  render=()=>{const changed=lastView!==view;lastView=view;originalRender();enhance();if(changed)window.scrollTo({top:0,behavior:'instant'});if(view==='payments'&&editingPaymentId){const form=document.getElementById('paymentForm');form?.scrollIntoView({block:'start'});form?.querySelector('input:not([type="hidden"])')?.focus({preventScroll:true});}};
  render();
})();
