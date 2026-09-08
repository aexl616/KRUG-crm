/* Patch 0.9.2: local activity feed. No network delivery or background push. */
const notificationCategories = { booking: 'Записи', service: 'Услуги', client: 'Клиенты', employee: 'Сотрудники', finance: 'Финансы: оплаты, расходы, выплаты', studioBlock: 'Технические блоки' };
let notificationFilter = 'unread';
let notificationTypeFilter = '';
let notificationSystemError = '';
let notificationSnapshot;
const notificationNativeSave = saveState;
const notificationEscape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function normalizeNotifications() {
  state.notifications = (Array.isArray(state.notifications) ? state.notifications : []).filter(n => n && n.id && n.type).map(n => ({ ...n, readBy: Array.isArray(n.readBy) ? n.readBy : [], audienceRoles: Array.isArray(n.audienceRoles) ? n.audienceRoles : [], audienceUserIds: Array.isArray(n.audienceUserIds) ? n.audienceUserIds : [] }));
  for (const key of ['notificationSettings', 'sentReminderKeys', 'notificationCriticalKeys']) {
    if (!state[key] || typeof state[key] !== 'object' || Array.isArray(state[key])) state[key] = {};
  }
}

function notificationPreferences(userId = currentUser()?.id) {
  const p = state.notificationSettings[userId] || {};
  return { inApp: p.inApp !== false, system: p.system === true, offsets: { 30: true, 15: true, 5: true, ...p.offsets }, categories: { ...Object.fromEntries(Object.keys(notificationCategories).map(k => [k, true])), ...p.categories } };
}

function notificationCategory(n) {
  return ['payment', 'payout', 'expense', 'financialWarning'].includes(n.entityType) ? 'finance' : n.entityType;
}

function canViewNotification(n) {
  const user = currentUser();
  if (!user || user.active === false) return false;
  if (!n.audienceRoles.includes(currentRole()) && !n.audienceUserIds.includes(user.id)) return false;
  const entity = notificationEntity(n);
  switch (n.entityType) {
    case 'booking': return entity ? canViewBooking(entity) : isManagerRole();
    case 'client': return canViewSection('clients') && (entity ? canViewClient(entity) : isManagerRole());
    case 'service': return canEditSettings();
    case 'employee': return canManageEmployees() || (n.entityId === user.id && n.type === 'employee_self_updated');
    case 'payment': return canViewPayment();
    case 'expense': return typeof canManageExpenses === 'function' && canManageExpenses();
    case 'payout': return entity ? canViewPayout(entity) : isManagerRole();
    case 'financialWarning': return canViewFinancialWarnings();
    case 'studioBlock': return canViewSection('calendar');
    default: return false;
  }
}

function notificationEntity(n) {
  const collections = { booking: 'bookings', client: 'clients', service: 'serviceItems', employee: 'users', payment: 'payments', payout: 'payouts', expense: 'expenses', studioBlock: 'studioBlocks' };
  return (state[collections[n.entityType]] || []).find(e => e.id === n.entityId);
}

function notificationsForCurrentUser() {
  const p = notificationPreferences();
  return state.notifications.filter(n => canViewNotification(n) && p.categories[notificationCategory(n)] !== false && (n.type !== 'booking_reminder' || p.offsets[n.reminderOffset] !== false)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
function unreadNotificationsCount() {
  return notificationPreferences().inApp ? notificationsForCurrentUser().filter(n => !n.readBy.includes(currentUser()?.id)).length : 0;
}
function persistNotificationMetadata() {
  // A timer/read click must never overwrite newer bookings or payments from another tab.
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  const events = new Map((saved.notifications || []).map(n => [n.id, n]));
  state.notifications.forEach(n => {
    const previous = events.get(n.id);
    events.set(n.id, { ...n, readBy: [...new Set([...(previous?.readBy || []), ...n.readBy])] });
  });
  state.notifications = [...events.values()].sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  trimNotifications();
  const userId = currentUser()?.id;
  const settings = { ...saved.notificationSettings };
  if (userId && state.notificationSettings[userId]) settings[userId] = state.notificationSettings[userId];
  state.sentReminderKeys = { ...saved.sentReminderKeys, ...state.sentReminderKeys };
  for (const [key, value] of Object.entries(state.sentReminderKeys)) {
    const booking = (saved.bookings || []).find(b => b.id === value?.bookingId);
    if (!booking || new Date(`${booking.date}T${booking.time}`).getTime() !== value.start) delete state.sentReminderKeys[key];
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...saved, notifications: state.notifications, notificationSettings: settings, sentReminderKeys: state.sentReminderKeys }));
}
function markNotificationRead(id) {
  const n = state.notifications.find(n => n.id === id);
  if (!n || !canViewNotification(n)) return;
  if (!n.readBy.includes(currentUser().id)) n.readBy.push(currentUser().id);
  persistNotificationMetadata();
  refreshNotificationUI();
}
function markAllNotificationsRead() {
  notificationsForCurrentUser().forEach(n => { if (!n.readBy.includes(currentUser().id)) n.readBy.push(currentUser().id); });
  persistNotificationMetadata();
  refreshNotificationUI();
}

function createNotification(data) {
  const n = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), audienceRoles: ['owner', 'admin'], audienceUserIds: [], readBy: [], severity: 'info', action: 'open', actorUserId: currentUser()?.id || '', actorName: currentUser()?.name || '', ...data };
  state.notifications.unshift(n);
  return n;
}

function trimNotifications() {
  // Prefer fully read events; a hard cap also bounds a never-read journal.
  while (state.notifications.length > 500) {
    let index = -1;
    for (let i = state.notifications.length - 1; i >= 0; i--) {
      const n = state.notifications[i];
      const recipients = state.users.filter(u => u.active !== false && (n.audienceRoles.includes(u.role) || n.audienceUserIds.includes(u.id)));
      if (recipients.every(u => n.readBy.includes(u.id))) { index = i; break; }
    }
    state.notifications.splice(index < 0 ? state.notifications.length - 1 : index, 1);
  }
}

const notificationFields = {
  expenses: {date:'Дата',category:'Категория',title:'Название',amount:'Сумма',employeeId:'Сотрудник',comment:'Комментарий',recurring:'Ежемесячно'},
  bookings: { date: 'Дата', time: 'Время', duration: 'Длительность', service: 'Услуга', serviceId: 'Услуга', employeeId: 'Сотрудник', status: 'Статус', client: 'Клиент', amount: 'Сумма' },
  serviceItems: { name: 'Название', categoryId: 'Категория', price: 'Цена', duration: 'Длительность', active: 'Доступность', order: 'Порядок' },
  serviceGroups: { name: 'Название', order: 'Порядок' },
  users: { name: 'Имя', role: 'Роль', position: 'Должность', active: 'Активность', phone: 'Телефон', telegram: 'Telegram', percent: 'Доля', fixedRate: 'Ставка' },
  clients: { name: 'Имя', phone: 'Телефон', telegram: 'Telegram', status: 'Статус', notes: 'Заметки', tags: 'Теги' },
  payments: { date: 'Дата', client: 'Клиент', service: 'Услуга', amount: 'Сумма', method: 'Способ', employee: 'Сотрудник', comment: 'Комментарий' },
  payouts: { amount: 'Сумма', status: 'Статус', employeeId: 'Сотрудник', paidAt: 'Дата', method: 'Способ' },
  studioBlocks: { date: 'Дата', time: 'Время', duration: 'Длительность', title: 'Название', type: 'Тип', status: 'Статус', comment: 'Комментарий' }
};
function notificationTakeSnapshot() {
  return structuredClone(Object.fromEntries(Object.keys(notificationFields).map(k => [k, state[k] || []])));
}
function notificationFieldValue(key, value) {
  if (key === 'employeeId') return state.users.find(u => u.id === value)?.name || 'Не назначен';
  if (key === 'serviceId') return state.serviceItems.find(s => s.id === value)?.name || 'Услуга';
  if (key === 'categoryId') return state.serviceGroups.find(s => s.id === value)?.name || 'Категория';
  if (typeof value === 'boolean') return value ? 'Да' : 'Нет';
  return Array.isArray(value) ? value.join(', ') : String(value ?? '—');
}

function collectNotificationChanges() {
  const specs = { expenses: ['expense', 'Расход'], bookings: ['booking', 'Запись'], serviceItems: ['service', 'Услуга'], serviceGroups: ['service', 'Категория услуг'], users: ['employee', 'Сотрудник'], clients: ['client', 'Клиент'], payments: ['payment', 'Оплата'], payouts: ['payout', 'Выплата'], studioBlocks: ['studioBlock', 'Технический блок'] };
  for (const [collection, [entityType, label]] of Object.entries(specs)) {
    const before = new Map(notificationSnapshot[collection].map(e => [e.id, e]));
    const after = new Map((state[collection] || []).map(e => [e.id, e]));
    for (const id of new Set([...before.keys(), ...after.keys()])) {
      const old = before.get(id), next = after.get(id), entity = next || old;
      const fields = Object.keys(notificationFields[collection]).filter(k => JSON.stringify(old?.[k]) !== JSON.stringify(next?.[k]));
      if (old && next && !fields.length) continue;
      // Derived client contacts are part of a booking/payment save, not separate activity.
      if (collection === 'clients' && !fields.some(k => ['status', 'notes', 'tags'].includes(k) && old && JSON.stringify(old[k]) !== JSON.stringify(next?.[k]))) {
        const derived = ['bookings', 'payments'].some(c => (state[c] || []).some(e => clientMatchesRecord(entity, e) && JSON.stringify(e) !== JSON.stringify(notificationSnapshot[c].find(p => p.id === e.id))));
        if (derived) continue;
      }
      let type = `${entityType === 'studioBlock' ? 'studio_block' : entityType}_${!old ? 'created' : !next ? 'deleted' : 'updated'}`;
      const titles = { expense: ['Добавлен расход', 'Расход изменён', 'Расход удалён'], booking: ['Создана запись', 'Запись изменена', 'Запись удалена'], service: ['Добавлена услуга', 'Услуга изменена', 'Услуга удалена'], employee: ['Добавлен сотрудник', 'Сотрудник изменён', 'Сотрудник удалён'], client: ['Добавлен клиент', 'Клиент изменён', 'Клиент удалён'], payment: ['Добавлена оплата', 'Оплата изменена', 'Оплата удалена'], payout: ['Учтена выплата', 'Выплата изменена', 'Выплата удалена'], studioBlock: ['Создан технический блок', 'Технический блок изменён', 'Технический блок удалён'] };
      let title = titles[entityType][!old ? 0 : !next ? 2 : 1];
      if (collection === 'serviceGroups') title = `${label}: ${!old ? 'добавление' : !next ? 'удаление' : 'изменение'}`;
      if (entityType === 'booking') {
        if (!old) title = 'Создана новая запись';
        else if (next && old.status !== next.status) {
          type = next.status === 'отменено' ? 'booking_cancelled' : 'booking_status_changed';
          title = next.status === 'отменено' ? 'Запись отменена' : next.status === 'завершено' ? 'Запись завершена' : 'Статус записи изменён';
        } else if (next) title = 'Запись изменена';
      }
      const summary = entity.client || entity.name || entity.title || entity.employeeName || label;
      const detail = old && next ? fields.filter(k => !(k === 'serviceId' && fields.includes('service'))).map(k => `${notificationFields[collection][k]} ${notificationFieldValue(k, old[k])} → ${notificationFieldValue(k, next[k])}`).join(' · ') : [entity.date, entity.time, entity.service, entity.duration, entity.amount != null ? `${entity.amount} ₽` : '', entity.price != null ? `${entity.price} ₽` : ''].filter(Boolean).join(' · ');
      const audienceUserIds = entityType === 'booking' || entityType === 'payout' ? [entity.employeeId].filter(Boolean) : [];
      if (entityType === 'client') audienceUserIds.push(...state.bookings.filter(b => clientMatchesRecord(entity, b)).map(b => b.employeeId).filter(Boolean));
      const n = createNotification({ type, entityType, entityId: id, title, message: `${summary}${detail ? ' · ' + detail : ''}`, audienceUserIds, audienceRoles: entityType === 'studioBlock' ? ['owner', 'admin', 'engineer', 'staff'] : ['owner', 'admin'], severity: type === 'booking_cancelled' ? 'warning' : !old || entity.status === 'завершено' ? 'success' : 'info', action: next && collection !== 'serviceGroups' ? 'open' : null });
      // Restricted roles never receive administrative employee details.
      if (entityType === 'employee' && next && old) createNotification({ type: 'employee_self_updated', entityType, entityId: id, title: 'Ваш профиль сотрудника обновлён', message: 'Проверьте изменения с администратором студии.', audienceRoles: [], audienceUserIds: [id], action: null });
      if (entityType === 'booking') n.restrictedMessage = `${summary} · ${entity.date} · ${entity.time} · ${entity.service || ''} · ${entity.status}`;
      if (entityType === 'client') n.restrictedMessage = `${summary} · Контактные данные или сведения о клиенте обновлены.`;
      if (entityType === 'payout') n.restrictedMessage = `Ваша выплата: ${entity.amount} ₽ · ${entity.status || ''}`;
      if (entityType === 'booking' && (!next || old?.date !== next.date || old?.time !== next.time)) {
        for (const key of Object.keys(state.sentReminderKeys)) if (state.sentReminderKeys[key].bookingId === id) delete state.sentReminderKeys[key];
      }
    }
  }
  const critical = financialWarnings().filter(w => w.level === 'critical');
  const active = {};
  critical.forEach(w => {
    const key = JSON.stringify([w.type, w.targetId, w.employeeId]);
    active[key] = true;
    if (!state.notificationCriticalKeys[key]) createNotification({ type: 'financial_warning', entityType: 'financialWarning', entityId: '', title: w.type, message: w.description || 'Проверьте расчёты в разделе выплат.', severity: 'critical' });
  });
  state.notificationCriticalKeys = active;
}

function notificationMessage(n) { return isRestrictedRole() && n.restrictedMessage ? n.restrictedMessage : n.message; }
function notificationPermission() { return typeof Notification === 'undefined' || !window.isSecureContext ? 'unsupported' : Notification.permission; }
function deliverSystemNotification(n) {
  const p = notificationPreferences();
  if (notificationPermission() !== 'granted' || !p.system || !canViewNotification(n) || p.categories[notificationCategory(n)] === false) return;
  if (n.type === 'booking_reminder' && p.offsets[n.reminderOffset] === false) return;
  const userId = currentUser().id;
  try {
    const popup = new Notification(n.title, { body: notificationMessage(n), tag: n.id });
    popup.onclick = () => { popup.close(); if (currentUser()?.id !== userId || !canViewNotification(n)) return; window.focus(); openNotificationTarget(n); };
    setTimeout(() => popup.close(), 20000);
  } catch { notificationSystemError = 'Этот браузер не смог показать системное уведомление. Уведомление сохранено внутри CRM.'; }
}

function checkUpcomingBookingReminders(now = Date.now(), persist = true) {
  if (!currentUser()) return [];
  if (persist) {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    // Another tab changed the schedule: do not send a stale reminder or write stale business data.
    if (Object.keys(notificationFields).some(k => JSON.stringify(saved[k] || []) !== JSON.stringify(state[k] || []))) return [];
    state.sentReminderKeys = { ...state.sentReminderKeys, ...saved.sentReminderKeys };
  }
  const p = notificationPreferences(), generated = [];
  const userId = currentUser().id;
  for (const b of accessibleBookings()) {
    const start = new Date(`${b.date}T${b.time}`).getTime();
    if (!['заявка', 'подтверждено'].includes(b.status) || !Number.isFinite(start) || start <= now) continue;
    const due = [5, 15, 30].filter(offset => p.offsets[offset] !== false && start - now <= offset * 60000);
    if (!due.length) continue;
    const offset = due[0], key = JSON.stringify([userId, b.id, start, offset]);
    if (state.sentReminderKeys[key]) continue;
    // Consume older thresholds too, so a background catch-up emits only one useful reminder.
    for (const value of [30, 15, 5].filter(value => value >= offset)) state.sentReminderKeys[JSON.stringify([userId, b.id, start, value])] = { bookingId: b.id, start, userId };
    const remaining = Math.max(1, Math.ceil((start - now) / 60000));
    generated.push(createNotification({ type: 'booking_reminder', entityType: 'booking', entityId: b.id, title: `Через ${remaining} мин. запись`, message: `${b.client || 'Клиент'} · ${b.time} · ${b.service || ''}`, audienceRoles: [], audienceUserIds: [userId], reminderOffset: offset, severity: offset === 5 ? 'warning' : 'info', actorUserId: '', actorName: '' }));
  }
  // Past schedules cannot produce reminders again; keep only current/future ledgers.
  for (const [key, value] of Object.entries(state.sentReminderKeys)) if (value.start <= now || !state.bookings.some(b => b.id === value.bookingId)) delete state.sentReminderKeys[key];
  if (persist && generated.length) { trimNotifications(); persistNotificationMetadata(); generated.forEach(deliverSystemNotification); refreshNotificationUI(); }
  return generated;
}

saveState = function saveStateWithNotifications() {
  const previousIds = new Set(state.notifications.map(n => n.id));
  collectNotificationChanges();
  checkUpcomingBookingReminders(Date.now(), false);
  trimNotifications();
  notificationNativeSave();
  notificationSnapshot = notificationTakeSnapshot();
  state.notifications.filter(n => !previousIds.has(n.id)).forEach(deliverSystemNotification);
};

function openNotificationTarget(n) {
  if (!n || !canViewNotification(n) || !n.action) return false;
  const entity = notificationEntity(n);
  if (!entity && n.entityType !== 'financialWarning') return false;
  markNotificationRead(n.id);
  switch (n.entityType) {
    case 'booking': view = 'calendar'; calendarDate = entity.date; selectedBookingId = entity.id; selectedStudioBlockId = null; break;
    case 'studioBlock': view = 'calendar'; calendarDate = entity.date; selectedStudioBlockId = entity.id; selectedBookingId = null; break;
    case 'client': view = 'clients'; selectedClientName = entity.name; break;
    case 'service': view = 'settings'; settingsTab = 'services'; break;
    case 'employee': if (!canManageEmployees()) return false; view = 'settings'; settingsTab = 'employees'; break;
    case 'payment': view = 'payments'; editingPaymentId = entity.id; break;
    case 'payout': view = 'payouts'; payoutEmployeeFilter = entity.employeeId; highlightedPayoutId = entity.id; break;
    case 'expense': view = 'expenses'; expenseEditingId = entity.id; expenseFormOpen = true; break;
    case 'financialWarning': view = canViewFinance() ? 'finance' : 'payouts'; payoutProblemsOnly = true; break;
    default: return false;
  }
  if (view === 'calendar') { calendarEmployeeFilter = ''; calendarStatusFilter = ''; calendarServiceFilter = ''; }
  notificationPanelOpen = false;
  render();
  return true;
}

function renderNotificationCenter() {
  const esc = notificationEscape, p = notificationPreferences();
  const items = notificationsForCurrentUser().filter(n => (notificationFilter !== 'unread' || !n.readBy.includes(currentUser().id)) && (!notificationTypeFilter || notificationCategory(n) === notificationTypeFilter));
  const categoryOptions = Object.entries(notificationCategories).filter(([k]) => k !== 'service' && k !== 'employee' || isManagerRole());
  return `<div class="nc-head"><div><h2 id="nc-title">Уведомления</h2><small>Изменения и напоминания студии</small></div><button type="button" class="btn secondary" data-nc-close>Закрыть</button></div>
    <div class="nc-toolbar"><button type="button" class="btn secondary" data-nc-filter="unread" aria-pressed="${notificationFilter === 'unread'}">Непрочитанные</button><button type="button" class="btn secondary" data-nc-filter="all" aria-pressed="${notificationFilter === 'all'}">Все</button><button type="button" class="btn secondary" data-nc-read-all>Прочитать все</button></div>
    <label class="nc-type">Тип события<select data-nc-type><option value="">Все типы</option>${categoryOptions.map(([k, v]) => `<option value="${k}" ${notificationTypeFilter === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <details class="nc-settings"><summary>Настройки моих уведомлений</summary>
    <label><input type="checkbox" data-nc-pref="inApp" ${p.inApp ? 'checked' : ''}> In-app уведомления</label>
    <label><input type="checkbox" data-nc-pref="system" ${p.system ? 'checked' : ''}> Системные уведомления</label>
    <button type="button" class="btn secondary" data-nc-permission ${['denied', 'unsupported'].includes(notificationPermission()) ? 'disabled' : ''}>Включить системные уведомления</button>
    <p class="muted">${({ default: 'Разрешение ещё не запрошено.', granted: 'Браузер разрешает уведомления.', denied: 'Запрещено браузером. Разрешение можно изменить в настройках сайта.', unsupported: 'Notification API недоступен. Используйте уведомления внутри CRM.' })[notificationPermission()]}</p>
    ${notificationSystemError ? `<p role="status">${esc(notificationSystemError)}</p>` : ''}
    <fieldset><legend>Напоминания о записи</legend>${[30, 15, 5].map(v => `<label><input type="checkbox" data-nc-offset="${v}" ${p.offsets[v] ? 'checked' : ''}> За ${v} минут</label>`).join('')}</fieldset>
    <fieldset><legend>Категории</legend>${categoryOptions.map(([k,v]) => `<label><input type="checkbox" data-nc-category="${k}" ${p.categories[k] ? 'checked' : ''}> ${v}</label>`).join('')}</fieldset>
    <p class="muted">В текущей версии системные напоминания работают, пока KRUG CRM запущена. Фоновые push-уведомления появятся после подключения серверной синхронизации.</p>
    <p class="muted">На некоторых мобильных браузерах доступны только in-app уведомления. Данные и настройки хранятся в этом браузере.</p></details>
    ${!p.inApp ? '<p class="nc-empty">In-app уведомления выключены. Журнал сохраняется; включите их в настройках, чтобы увидеть события.</p>' : `<div class="nc-list">${items.map(n => `<article class="nc-item ${n.readBy.includes(currentUser().id) ? 'is-read' : ''}" data-severity="${esc(n.severity)}"><div class="nc-item-head"><strong>${esc(n.title)}</strong><span>${n.readBy.includes(currentUser().id) ? 'Прочитано' : 'Новое'}</span></div><p>${esc(notificationMessage(n))}</p><small>${esc(new Date(n.createdAt).toLocaleString('ru-RU'))}${n.actorName && !isRestrictedRole() ? ' · ' + esc(n.actorName) : ''}</small><div class="nc-actions">${n.action && (notificationEntity(n) || n.entityType === 'financialWarning') ? `<button type="button" class="btn secondary" data-nc-open="${esc(n.id)}">Открыть</button>` : '<small>Переход недоступен</small>'}${!n.readBy.includes(currentUser().id) ? `<button type="button" class="btn secondary" data-nc-read="${esc(n.id)}">Прочитано</button>` : ''}</div></article>`).join('') || '<p class="nc-empty">Нет уведомлений по выбранным фильтрам.</p>'}</div>`}`;
}

function refreshNotificationUI() {
  const bell = document.querySelector('[data-action="toggleNotifications"]');
  if (!bell || !currentUser()) return;
  const count = unreadNotificationsCount();
  bell.innerHTML = `🔔${count ? `<em>${count > 99 ? '99+' : count}</em>` : ''}`;
  bell.setAttribute('aria-label', `Уведомления: ${count} непрочитанных`);
  bell.setAttribute('aria-haspopup', 'dialog');
  bell.setAttribute('aria-expanded', String(notificationPanelOpen));
  let panel = document.querySelector('.notification-popover');
  if (panel) {
    if (panel.tagName !== 'DIALOG') {
      const dialog = document.createElement('dialog');
      dialog.className = 'notification-popover';
      panel.replaceWith(dialog); panel = dialog;
      dialog.addEventListener('cancel', event => { event.preventDefault(); notificationPanelOpen = false; render(); document.querySelector('[data-action="toggleNotifications"]')?.focus(); });
    }
    const active = document.activeElement;
    const focusAttribute = ['data-nc-pref', 'data-nc-offset', 'data-nc-category', 'data-nc-type', 'data-nc-filter', 'data-nc-read-all', 'data-nc-permission'].find(attr => active?.hasAttribute(attr));
    const focusValue = focusAttribute ? active.getAttribute(focusAttribute) : null;
    const hadFocus = panel.contains(active);
    const settingsOpen = panel.querySelector('.nc-settings')?.open;
    const scroll = panel.scrollTop;
    panel.innerHTML = renderNotificationCenter();
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-labelledby', 'nc-title');
    panel.querySelector('.nc-settings').open = Boolean(settingsOpen);
    panel.scrollTop = scroll;
    if (!panel.open) panel.showModal();
    if (hadFocus) {
      const target = focusAttribute ? [...panel.querySelectorAll(`[${focusAttribute}]`)].find(el => el.getAttribute(focusAttribute) === focusValue) : null;
      (target || panel.querySelector('[data-nc-close]'))?.focus({ preventScroll: true });
    }
  }
}

const notificationOriginalRender = render;
// The old transient summary is replaced by the persistent, access-checked journal.
renderNotifications = () => '';
render = function renderWithNotificationCenter() {
  notificationOriginalRender();
  refreshNotificationUI();
  if (notificationPanelOpen) document.querySelector('[data-nc-close]')?.focus({ preventScroll: true });
};
document.addEventListener('click', async event => {
  const button = event.target.closest('button');
  if (!button || !currentUser()) return;
  if (button.hasAttribute('data-nc-close')) { notificationPanelOpen = false; render(); document.querySelector('[data-action="toggleNotifications"]')?.focus(); }
  if (button.dataset.ncFilter) { notificationFilter = button.dataset.ncFilter; refreshNotificationUI(); }
  if (button.hasAttribute('data-nc-read-all')) markAllNotificationsRead();
  if (button.dataset.ncRead) markNotificationRead(button.dataset.ncRead);
  if (button.dataset.ncOpen) openNotificationTarget(state.notifications.find(n => n.id === button.dataset.ncOpen));
  if (button.hasAttribute('data-nc-permission')) {
    const userId = currentUser().id;
    try { if (notificationPermission() !== 'unsupported') { const result = await Notification.requestPermission(); if (currentUser()?.id === userId) { const p = notificationPreferences(userId); p.system = result === 'granted'; state.notificationSettings[userId] = p; persistNotificationMetadata(); } } }
    catch { notificationSystemError = 'Не удалось запросить разрешение. In-app уведомления продолжают работать.'; }
    refreshNotificationUI();
  }
});
document.addEventListener('change', event => {
  const el = event.target;
  if (!currentUser()) return;
  if (el.hasAttribute('data-nc-type')) { notificationTypeFilter = el.value; refreshNotificationUI(); return; }
  if (!el.matches('[data-nc-pref],[data-nc-offset],[data-nc-category]')) return;
  const p = notificationPreferences();
  if (el.dataset.ncPref) p[el.dataset.ncPref] = el.checked;
  if (el.dataset.ncOffset) p.offsets[el.dataset.ncOffset] = el.checked;
  if (el.dataset.ncCategory) p.categories[el.dataset.ncCategory] = el.checked;
  state.notificationSettings[currentUser().id] = p;
  persistNotificationMetadata(); refreshNotificationUI();
});
document.addEventListener('keydown', event => {
  if (!notificationPanelOpen || event.key !== 'Tab') return;
  const panel = document.querySelector('.notification-popover');
  const controls = [...(panel?.querySelectorAll('button,select,input,summary') || [])].filter(el => !el.disabled && el.getClientRects().length);
  const first = controls[0], last = controls[controls.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
});
normalizeNotifications();
notificationSnapshot = notificationTakeSnapshot();
notificationNativeSave();
function runNotificationReminderCheck() {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request('krug-booking-reminders', () => checkUpcomingBookingReminders());
  }
  return checkUpcomingBookingReminders();
}
runNotificationReminderCheck();
setInterval(runNotificationReminderCheck, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) runNotificationReminderCheck(); });
render();
