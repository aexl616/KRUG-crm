(() => {
  'use strict';

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  renderDashboard = function renderDashboardClean() {
    const data = studioTodayData();
    const pending = data.bookings.filter(booking => booking.status === 'заявка').length;
    const active = data.bookings.filter(booking => booking.status !== 'отменено');
    const next = data.nextBooking;

    const nextMarkup = next ? `
      <button class="crm-next-session" type="button" data-open-booking="${next.id}">
        <div class="crm-next-time"><strong>${esc(next.time)}</strong><span>${esc(next.duration || '1 час')}</span></div>
        <div class="crm-next-main"><span class="crm-kicker">Ближайшая сессия</span><strong>${esc(next.client || 'Без имени')}</strong><small>${esc(next.serviceName || next.service || 'Услуга не указана')} · ${esc(next.employee || 'сотрудник не указан')}</small></div>
        <span class="status-pill status-${String(next.status).replaceAll(' ','-')}">${statusTitle(next.status)}</span>
      </button>` : `
      <div class="crm-empty-line"><strong>Ближайших сессий сегодня нет</strong><span>Расписание свободно.</span></div>`;

    return `
      <div class="crm-today-clean">
        <header class="crm-page-head">
          <div><span class="crm-kicker">Сегодня</span><h1>${formatDate(data.today)}</h1><p>${weekdayLong(data.today)} · ${active.length} ${plural(active.length,'запись','записи','записей')}</p></div>
          <div class="crm-page-actions">
            ${canCreateBooking() ? '<button class="btn" type="button" data-action="openBookingModal">+ Новая запись</button>' : ''}
            <button class="btn secondary" type="button" data-view="calendar">Календарь</button>
          </div>
        </header>
        ${pending ? `<button class="crm-inline-alert" type="button" data-view="bookings"><strong>${pending}</strong><span>${plural(pending,'заявка ждёт','заявки ждут','заявок ждут')} подтверждения</span><b>Открыть →</b></button>` : ''}
        <section class="crm-clean-section">${nextMarkup}</section>
        <section class="crm-clean-section">
          <div class="crm-section-head"><div><h2>Расписание</h2><p>Все сессии на сегодня в одном списке.</p></div><button class="link-button" data-view="bookings">Все записи →</button></div>
          <div class="crm-today-list">
            ${data.bookings.length ? data.bookings.map(booking => `
              <button class="crm-today-row ${booking.status === 'отменено' ? 'is-cancelled' : ''}" type="button" data-open-booking="${booking.id}">
                <span class="crm-row-time">${esc(booking.time)}</span>
                <span class="crm-row-main"><strong>${esc(booking.client || 'Без имени')}</strong><small>${esc(booking.serviceName || booking.service || 'Услуга')} · ${esc(booking.duration || '1 час')}</small></span>
                <span class="crm-row-employee">${esc(booking.employee || 'не назначен')}</span>
                <span class="status-pill status-${String(booking.status).replaceAll(' ','-')}">${statusTitle(booking.status)}</span>
              </button>`).join('') : `<div class="crm-empty-line"><strong>Сегодня записей нет</strong><span>Новая запись появится здесь автоматически.</span></div>`}
          </div>
        </section>
      </div>`;
  };

  renderBookingCard = function renderBookingCardClean(booking) {
    return `
      <button class="crm-booking-row ${booking.status === 'отменено' ? 'is-cancelled' : ''}" type="button" data-open-booking="${booking.id}">
        <span class="crm-booking-date"><strong>${formatDate(booking.date)}</strong><small>${esc(booking.time)} · ${esc(booking.duration || '1 час')}</small></span>
        <span class="crm-booking-client"><strong>${esc(booking.client || 'Без имени')}</strong><small>${esc(booking.phone || booking.telegram || 'контакт не указан')}</small></span>
        <span class="crm-booking-service"><strong>${esc(booking.serviceName || booking.service || 'Услуга')}</strong><small>${esc(booking.employee || 'сотрудник не указан')}</small></span>
        <strong class="crm-booking-price">${money(booking.amount)}</strong>
        <span class="status-pill status-${String(booking.status).replaceAll(' ','-')}">${statusTitle(booking.status)}</span>
      </button>`;
  };

  renderBookings = function renderBookingsClean() {
    const bookings = filteredBookings();
    const services = [...new Map([...catalogServices().map(service => [service.id, service]), ...state.bookings.filter(booking => booking.service).map(booking => [booking.serviceId || booking.service, {id:booking.serviceId || booking.service,name:booking.service}])]).values()];
    const employeeSource = isManagerRole() ? state.users : [currentUser()].filter(Boolean);
    const employees = [...new Map([...employeeSource.map(user => [user.id || user.name,user]), ...bookings.filter(booking => booking.employee).map(booking => [booking.employeeId || booking.employee,{id:booking.employeeId || booking.employee,name:booking.employee}])]).values()];

    return `
      <div class="crm-bookings-clean">
        <section class="crm-clean-section">
          <div class="crm-section-head"><div><h2>Записи</h2><p>Клик по строке открывает запись и все действия по ней.</p></div>${canCreateBooking() ? '<button class="btn" type="button" data-action="openBookingModal">+ Новая запись</button>' : ''}</div>
          <div class="crm-filterbar">
            <input id="bookingSearchFilter" placeholder="Клиент, телефон, Telegram" value="${esc(bookingSearchFilter)}" />
            <input id="bookingDateFilter" type="date" value="${esc(bookingDateFilter)}" />
            <select id="bookingStatusFilter"><option value="">Все статусы</option>${bookingStatuses.map(status => `<option value="${status}" ${bookingStatusFilter===status?'selected':''}>${statusTitle(status)}</option>`).join('')}</select>
            <select id="bookingEmployeeFilter"><option value="">Все сотрудники</option>${employees.map(employee => `<option value="${employee.id || employee.name}" ${bookingEmployeeFilter===(employee.id || employee.name)||bookingEmployeeFilter===employee.name?'selected':''}>${esc(employee.name)}</option>`).join('')}</select>
            <select id="bookingServiceFilter"><option value="">Все услуги</option>${services.map(service => `<option value="${service.id || service.name}" ${bookingServiceFilter===(service.id || service.name)||bookingServiceFilter===service.name?'selected':''}>${esc(service.name)}</option>`).join('')}</select>
          </div>
          <div class="crm-booking-list">${bookings.map(renderBookingCard).join('') || renderEmptyState('Пока нет записей','Новые записи из Mini App и CRM появятся здесь.')}</div>
        </section>
      </div>`;
  };

  renderClients = function renderClientsClean() {
    const query = clientFilter.trim().toLowerCase();
    const availableClients = (state.clients || []).filter(canViewClient);
    const clients = availableClients
      .map(client => ({client,stats:clientStats(client)}))
      .filter(({client}) => !query || [client.name,client.phone,client.telegram,client.status].some(value => String(value || '').toLowerCase().includes(query)))
      .filter(({client}) => !clientStatusFilter || client.status === clientStatusFilter)
      .filter(({stats}) => clientSegmentFilter === 'all' || clientSegmentFilter === 'future' && stats.nextBooking || clientSegmentFilter === 'sleeping' && stats.daysSinceLast >= 60 || clientSegmentFilter === 'regular' && stats.completedBookings >= 3)
      .sort((a,b) => sortClients(a.client.name,b.client.name,a.stats.totalRevenue,b.stats.totalRevenue));

    if (selectedClientName && canViewClient(selectedClientName)) return renderClientDetail(selectedClientName);
    if (selectedClientName) selectedClientName = null;

    return `
      <section class="crm-clean-section crm-clients-clean">
        <div class="crm-section-head"><div><h2>Клиенты</h2><p>${clients.length} в базе</p></div></div>
        <div class="crm-client-filterbar">
          <input id="searchPayments" placeholder="Имя, телефон или Telegram" value="${esc(clientFilter)}" />
          <select id="clientStatusFilter"><option value="">Все статусы</option>${clientStatuses.map(status => `<option ${clientStatusFilter===status?'selected':''}>${status}</option>`).join('')}</select>
          <select id="clientSegmentFilter">${[['all','Все клиенты'],['future','Есть будущая запись'],['sleeping','Спящие'],['regular','Постоянные']].map(([value,label]) => `<option value="${value}" ${clientSegmentFilter===value?'selected':''}>${label}</option>`).join('')}</select>
        </div>
        <div class="crm-client-list">
          ${clients.map(({client,stats}) => `
            <button class="crm-client-row" type="button" data-client="${encodeURIComponent(client.id || client.name)}">
              <span class="avatar client-avatar">${initials(client.name)}</span>
              <span class="crm-client-main"><strong>${esc(client.name)}</strong><small>${esc([client.phone,client.telegram].filter(Boolean).join(' · ') || 'контакты не указаны')}</small></span>
              <span class="crm-client-stat"><small>Записей</small><strong>${stats.totalBookings}</strong></span>
              <span class="crm-client-stat"><small>Последнее</small><strong>${stats.lastBookingDate ? formatDate(stats.lastBookingDate) : '—'}</strong></span>
              <span class="client-status status-${String(client.status || 'Новый').toLowerCase()}">${esc(client.status || 'Новый')}</span>
            </button>`).join('') || renderEmptyState('Клиентов пока нет','Профили появятся после регистрации в Mini App или ручного добавления через запись.')}
        </div>
      </section>`;
  };

  try { render(); } catch (error) { console.warn('[KRUG CRM] polish render skipped', error); }
})();
