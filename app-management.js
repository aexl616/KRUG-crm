(() => {
  'use strict';

  const STORAGE_KEY = 'studio-income-app-v1';
  const TOKEN_KEY = 'krug-app-admin-token';
  const IMPORT_KEY = 'krug-app-admin-import-snapshot';
  const API_URL = '/api/app-admin';
  const root = document.getElementById('app');
  if (!root) return;

  const ui = {
    active: false,
    data: null,
    filter: 'all',
    loading: false,
    notice: '',
    noticeType: 'success'
  };

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const initials = value => String(value || '?').trim().split(/\s+/).slice(0, 2).map(part => [...part][0] || '').join('').toUpperCase() || '?';
  const points = value => new Intl.NumberFormat('ru-RU').format(Number(value) || 0);

  function readLocalState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function currentRole() {
    const state = readLocalState();
    const user = (state.users || []).find(item => item.id === state.sessionUserId);
    return user?.role || null;
  }

  function canManage() {
    return ['owner', 'admin'].includes(currentRole());
  }

  function adminToken() {
    return sessionStorage.getItem(TOKEN_KEY) || '';
  }

  async function adminRequest(action, payload = {}) {
    const token = adminToken();
    if (!token) throw Object.assign(new Error('Нужен ключ управления Mini App.'), { code: 'ADMIN_TOKEN_REQUIRED' });
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ action, ...payload })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      const error = new Error(result.message || 'Не удалось выполнить операцию.');
      error.code = result.error || 'APP_ADMIN_UNAVAILABLE';
      throw error;
    }
    return result.data;
  }

  function localClientsPayload() {
    const state = readLocalState();
    return (Array.isArray(state.clients) ? state.clients : [])
      .filter(client => client && client.id && String(client.name || '').trim())
      .slice(0, 1000)
      .map(client => ({
        id: String(client.id),
        name: String(client.name || '').trim(),
        phone: String(client.phone || '').trim(),
        telegram: String(client.telegram || '').trim()
      }));
  }

  async function importLocalClients(force = false) {
    const clients = localClientsPayload();
    if (!clients.length) return;
    const snapshot = JSON.stringify(clients);
    if (!force && sessionStorage.getItem(IMPORT_KEY) === snapshot) return;
    await adminRequest('importClients', { clients });
    sessionStorage.setItem(IMPORT_KEY, snapshot);
  }

  async function loadOverview({ syncLocal = true, forceImport = false } = {}) {
    ui.loading = true;
    renderCurrent();
    try {
      if (syncLocal) await importLocalClients(forceImport);
      ui.data = await adminRequest('overview');
      ui.notice = '';
    } catch (error) {
      if (error.code === 'ADMIN_UNAUTHORIZED' || error.code === 'ADMIN_TOKEN_REQUIRED') {
        sessionStorage.removeItem(TOKEN_KEY);
        ui.data = null;
        ui.notice = error.message;
        ui.noticeType = 'error';
      } else {
        ui.notice = error.message || 'Не удалось загрузить данные Mini App.';
        ui.noticeType = 'error';
      }
    } finally {
      ui.loading = false;
      renderCurrent();
    }
  }

  function markNavActive() {
    document.querySelectorAll('.nav button, .mobile-tabs button').forEach(button => button.classList.remove('active'));
    document.querySelectorAll('.app-mgmt-nav-button').forEach(button => button.classList.toggle('active', ui.active));
  }

  function ensureButtons() {
    const allowed = canManage();
    const navs = document.querySelectorAll('.nav, .mobile-tabs');
    if (!allowed) {
      document.querySelectorAll('.app-mgmt-nav-button').forEach(button => button.remove());
      if (ui.active) ui.active = false;
      return;
    }
    navs.forEach(nav => {
      if (nav.querySelector('.app-mgmt-nav-button')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'app-mgmt-nav-button';
      button.textContent = 'Mini App';
      button.addEventListener('click', () => openManagement());
      nav.appendChild(button);
    });
    markNavActive();
  }

  function openManagement() {
    if (!canManage()) return;
    ui.active = true;
    markNavActive();
    renderCurrent();
    if (adminToken() && !ui.data) loadOverview({ syncLocal: true });
  }

  function contentNode() {
    return root.querySelector('.content');
  }

  function renderCurrent() {
    if (!ui.active) return;
    const content = contentNode();
    if (!content) return;
    markNavActive();
    if (!adminToken()) renderLocked(content);
    else renderDashboard(content);
  }

  function noticeMarkup() {
    if (!ui.notice) return '';
    return `<div class="${ui.noticeType === 'error' ? 'app-mgmt-error' : 'app-mgmt-success'}" role="status">${escapeHtml(ui.notice)}</div>`;
  }

  function renderLocked(content) {
    content.innerHTML = `
      <section class="app-management-screen app-mgmt-lock">
        <div class="app-mgmt-card app-mgmt-lock-card">
          <p class="app-management-kicker">КРУГ · MINI APP</p>
          <h2>Управление приложением</h2>
          <p>Здесь будут пользователи Mini App, баллы, блокировки и найденные дубли клиентских профилей. Для тестового периода раздел закрыт отдельным ключом управления.</p>
          ${noticeMarkup()}
          <form class="app-mgmt-lock-form" id="appMgmtUnlockForm">
            <label class="app-mgmt-field">Ключ управления
              <input id="appMgmtToken" type="password" autocomplete="off" required placeholder="krug_…">
            </label>
            <button class="app-mgmt-btn primary" type="submit">Открыть управление</button>
          </form>
        </div>
      </section>`;

    content.querySelector('#appMgmtUnlockForm')?.addEventListener('submit', async event => {
      event.preventDefault();
      const token = content.querySelector('#appMgmtToken')?.value.trim();
      if (!token) return;
      sessionStorage.setItem(TOKEN_KEY, token);
      ui.notice = '';
      await loadOverview({ syncLocal: true, forceImport: true });
    });
  }

  function categoryLabel(category) {
    return {
      app_registered: 'Зарегистрирован · ещё не был',
      app_visited: 'Mini App · был на студии',
      external: 'Вручную / другой канал'
    }[category] || category;
  }

  function categoryBadge(category) {
    const tone = category === 'app_visited' ? 'green' : category === 'app_registered' ? 'orange' : '';
    return `<span class="app-mgmt-badge ${tone}">${escapeHtml(categoryLabel(category))}</span>`;
  }

  function filteredClients() {
    const clients = Array.isArray(ui.data?.clients) ? ui.data.clients : [];
    if (ui.filter === 'banned') return clients.filter(client => client.banned);
    if (ui.filter === 'all') return clients;
    return clients.filter(client => client.category === ui.filter);
  }

  function metrics() {
    const clients = Array.isArray(ui.data?.clients) ? ui.data.clients : [];
    return {
      appRegistered: clients.filter(client => client.category === 'app_registered').length,
      appVisited: clients.filter(client => client.category === 'app_visited').length,
      external: clients.filter(client => client.category === 'external').length,
      banned: clients.filter(client => client.banned).length,
      merges: Array.isArray(ui.data?.mergeCandidates) ? ui.data.mergeCandidates.length : 0
    };
  }

  function renderMergeCandidates() {
    const rows = Array.isArray(ui.data?.mergeCandidates) ? ui.data.mergeCandidates : [];
    if (!rows.length) return '';
    return `
      <section class="app-mgmt-card">
        <div class="app-mgmt-section-head">
          <div><h2>Найдены совпадения</h2><p>Имя и номер телефона совпали. Профили не объединяются автоматически.</p></div>
          <span class="app-mgmt-badge orange">${rows.length} на проверку</span>
        </div>
        <div class="app-mgmt-merge-list">
          ${rows.map(row => `
            <article class="app-mgmt-merge">
              <div class="app-mgmt-merge-profile">
                <span class="app-mgmt-badge orange">Mini App</span>
                <strong>${escapeHtml(row.app?.name)}</strong>
                <small>${escapeHtml(row.app?.phone || 'Без телефона')} · ${escapeHtml(row.app?.telegram || 'без @username')}</small>
              </div>
              <span class="app-mgmt-merge-arrow">↔</span>
              <div class="app-mgmt-merge-profile">
                <span class="app-mgmt-badge">CRM / вручную</span>
                <strong>${escapeHtml(row.external?.name)}</strong>
                <small>${escapeHtml(row.external?.phone || 'Без телефона')} · ${escapeHtml(row.external?.telegram || 'без @username')}</small>
              </div>
              <div class="app-mgmt-merge-actions">
                <button class="app-mgmt-btn primary" type="button" data-merge="${escapeHtml(row.id)}">Объединить</button>
                <button class="app-mgmt-btn ghost" type="button" data-dismiss-merge="${escapeHtml(row.id)}">Не объединять</button>
              </div>
            </article>`).join('')}
        </div>
      </section>`;
  }

  function renderClientRow(client) {
    return `
      <article class="app-mgmt-client">
        <div class="app-mgmt-client-main">
          <span class="app-mgmt-avatar">${escapeHtml(initials(client.name))}</span>
          <div style="min-width:0">
            <strong>${escapeHtml(client.name)}</strong>
            <small>${escapeHtml(client.phone || 'Телефон не указан')}</small>
            <div class="app-mgmt-badges">
              ${categoryBadge(client.category)}
              ${client.banned ? '<span class="app-mgmt-badge red">BANNED</span>' : ''}
            </div>
          </div>
        </div>
        <div class="app-mgmt-client-contact">
          <strong>${escapeHtml(client.telegram || 'Telegram не указан')}</strong>
          <small>${client.telegramUserId ? `TG ID ${escapeHtml(client.telegramUserId)}` : 'Telegram user ID ещё не привязан'}</small>
        </div>
        <div class="app-mgmt-balance">
          <strong>${points(client.loyaltyBalance)}</strong>
          <span>баллов</span>
        </div>
        <div class="app-mgmt-client-actions">
          <button class="app-mgmt-btn ghost" type="button" data-points-client="${escapeHtml(client.id)}">± Баллы</button>
          ${client.telegramUserId ? `<button class="app-mgmt-btn ${client.banned ? 'ghost' : 'danger'}" type="button" data-ban-client="${escapeHtml(client.id)}">${client.banned ? 'Unban' : 'Ban'}</button>` : ''}
        </div>
      </article>`;
  }

  function renderDashboard(content) {
    if (!ui.data) {
      content.innerHTML = `
        <section class="app-management-screen app-mgmt-lock">
          <div class="app-mgmt-card app-mgmt-lock-card">
            <p class="app-management-kicker">КРУГ · MINI APP</p>
            <h2>${ui.loading ? 'Загружаем управление…' : 'Управление Mini App'}</h2>
            ${noticeMarkup()}
            ${ui.loading ? '<p>Синхронизируем клиентскую базу CRM с Supabase.</p>' : '<button class="app-mgmt-btn primary" id="appMgmtRetry">Попробовать снова</button>'}
          </div>
        </section>`;
      content.querySelector('#appMgmtRetry')?.addEventListener('click', () => loadOverview({ syncLocal: true, forceImport: true }));
      return;
    }

    const m = metrics();
    const settings = ui.data.settings || {};
    const rows = filteredClients();
    const tabs = [
      ['all', 'Все'], ['app_registered', 'Только зарегистрировались'], ['app_visited', 'Были на студии'], ['external', 'Другой канал'], ['banned', 'Banned']
    ];

    content.innerHTML = `
      <section class="app-management-screen">
        <header class="app-management-head">
          <div>
            <p class="app-management-kicker">КРУГ · MINI APP CONTROL</p>
            <h1>Управление приложением</h1>
            <p class="app-management-subtitle">Пользователи, баллы, блокировки и объединение клиентских профилей. Данные Mini App хранятся в Supabase; локальная клиентская база CRM синхронизируется сюда как отдельный источник.</p>
          </div>
          <div class="app-management-head-actions">
            <button class="app-mgmt-btn ghost" id="appMgmtRefresh" type="button" ${ui.loading ? 'disabled' : ''}>${ui.loading ? 'Обновляем…' : 'Обновить'}</button>
            <button class="app-mgmt-btn ghost" id="appMgmtLock" type="button">Сменить ключ</button>
          </div>
        </header>
        ${noticeMarkup()}

        <div class="app-mgmt-grid">
          <article class="app-mgmt-card app-mgmt-stat"><span>Зарегистрировались, не были</span><strong>${m.appRegistered}</strong><small>группа 1</small></article>
          <article class="app-mgmt-card app-mgmt-stat"><span>Mini App + были на студии</span><strong>${m.appVisited}</strong><small>группа 2</small></article>
          <article class="app-mgmt-card app-mgmt-stat"><span>Вручную / другой канал</span><strong>${m.external}</strong><small>группа 3</small></article>
          <article class="app-mgmt-card app-mgmt-stat ${m.merges ? 'attention' : ''}"><span>Совпадения на проверку</span><strong>${m.merges}</strong><small>${m.banned} пользователей banned</small></article>
        </div>

        <section class="app-mgmt-card">
          <div class="app-mgmt-section-head">
            <div><h2>Политика баллов</h2><p>Процент от оплаченной суммы, который будет начисляться клиенту после закрытия оплаченной сессии.</p></div>
            <span class="app-mgmt-badge">1 балл = ${escapeHtml(settings.rublesPerPoint || 1)} ₽</span>
          </div>
          <form class="app-mgmt-policy" id="appMgmtPolicyForm">
            <label>Начисление, % от оплаты
              <input type="number" id="appMgmtPercent" min="0" max="100" step="0.1" value="${escapeHtml(settings.accrualPercent ?? 5)}" required>
            </label>
            <button class="app-mgmt-btn primary" type="submit">Сохранить политику</button>
          </form>
          <p class="app-mgmt-help">Сейчас правило уже хранится централизованно. Автоматическое начисление привяжем к моменту, когда CRM фиксирует фактическую оплату на студии — не к созданию брони.</p>
        </section>

        ${renderMergeCandidates()}

        <section class="app-mgmt-card">
          <div class="app-mgmt-section-head">
            <div><h2>Ban / unban по Telegram user ID</h2><p>Можно заблокировать ID даже до того, как человек зарегистрируется в Mini App.</p></div>
          </div>
          <form class="app-mgmt-ban-form" id="appMgmtBanForm">
            <input type="number" id="appMgmtBanId" min="1" step="1" placeholder="Telegram user ID" required>
            <input type="text" id="appMgmtBanReason" maxlength="500" placeholder="Причина (необязательно)">
            <button class="app-mgmt-btn danger" type="submit">Ban</button>
          </form>
        </section>

        <section class="app-mgmt-card">
          <div class="app-mgmt-section-head">
            <div><h2>Клиентская база Mini App</h2><p>${rows.length} из ${(ui.data.clients || []).length} клиентов</p></div>
          </div>
          <div class="app-mgmt-tabs" role="tablist">
            ${tabs.map(([id, label]) => `<button type="button" class="app-mgmt-tab ${ui.filter === id ? 'active' : ''}" data-app-filter="${id}">${label}</button>`).join('')}
          </div>
          <div class="app-mgmt-clients" style="margin-top:14px">
            ${rows.length ? rows.map(renderClientRow).join('') : '<div class="app-mgmt-empty">В этой категории пока никого нет.</div>'}
          </div>
        </section>
      </section>`;

    bindDashboard(content);
  }

  function findClient(id) {
    return (ui.data?.clients || []).find(client => client.id === id) || null;
  }

  function setNotice(message, type = 'success') {
    ui.notice = message;
    ui.noticeType = type;
  }

  function bindDashboard(content) {
    content.querySelector('#appMgmtRefresh')?.addEventListener('click', () => loadOverview({ syncLocal: true, forceImport: true }));
    content.querySelector('#appMgmtLock')?.addEventListener('click', () => {
      sessionStorage.removeItem(TOKEN_KEY);
      ui.data = null;
      setNotice('Ключ очищен для этой сессии.', 'success');
      renderCurrent();
    });

    content.querySelector('#appMgmtPolicyForm')?.addEventListener('submit', async event => {
      event.preventDefault();
      const percent = Number(content.querySelector('#appMgmtPercent')?.value);
      try {
        await adminRequest('setPolicy', { percent });
        setNotice(`Политика начисления: ${percent}% от оплаченной суммы.`);
        await loadOverview({ syncLocal: false });
      } catch (error) {
        setNotice(error.message, 'error');
        renderCurrent();
      }
    });

    content.querySelector('#appMgmtBanForm')?.addEventListener('submit', async event => {
      event.preventDefault();
      const telegramUserId = Number(content.querySelector('#appMgmtBanId')?.value);
      const reason = String(content.querySelector('#appMgmtBanReason')?.value || '').trim();
      try {
        await adminRequest('setBan', { telegramUserId, banned: true, reason });
        setNotice(`Telegram ID ${telegramUserId} заблокирован.`);
        event.target.reset();
        await loadOverview({ syncLocal: false });
      } catch (error) {
        setNotice(error.message, 'error');
        renderCurrent();
      }
    });

    content.querySelectorAll('[data-app-filter]').forEach(button => button.addEventListener('click', () => {
      ui.filter = button.dataset.appFilter;
      renderCurrent();
    }));

    content.querySelectorAll('[data-points-client]').forEach(button => button.addEventListener('click', () => {
      const client = findClient(button.dataset.pointsClient);
      if (client) openPointsModal(client);
    }));

    content.querySelectorAll('[data-ban-client]').forEach(button => button.addEventListener('click', () => {
      const client = findClient(button.dataset.banClient);
      if (client) openBanModal(client);
    }));

    content.querySelectorAll('[data-merge]').forEach(button => button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await adminRequest('merge', { candidateId: button.dataset.merge });
        setNotice('Профили объединены. История и баллы закреплены за профилем Mini App.');
        await loadOverview({ syncLocal: true, forceImport: true });
      } catch (error) {
        setNotice(error.message, 'error');
        renderCurrent();
      }
    }));

    content.querySelectorAll('[data-dismiss-merge]').forEach(button => button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await adminRequest('dismissMerge', { candidateId: button.dataset.dismissMerge });
        setNotice('Совпадение скрыто. Профили оставлены раздельными.');
        await loadOverview({ syncLocal: false });
      } catch (error) {
        setNotice(error.message, 'error');
        renderCurrent();
      }
    }));
  }

  function closeModal() {
    document.querySelector('.app-mgmt-modal-backdrop')?.remove();
  }

  function modalShell(title, description, fields, submitLabel, danger = false) {
    closeModal();
    const wrapper = document.createElement('div');
    wrapper.className = 'app-mgmt-modal-backdrop';
    wrapper.innerHTML = `
      <form class="app-mgmt-modal" id="appMgmtModalForm">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(description)}</p>
        <div class="app-mgmt-modal-fields">${fields}</div>
        <div class="app-mgmt-modal-actions">
          <button type="button" class="app-mgmt-btn ghost" data-modal-close>Отмена</button>
          <button type="submit" class="app-mgmt-btn ${danger ? 'danger' : 'primary'}">${escapeHtml(submitLabel)}</button>
        </div>
      </form>`;
    document.body.appendChild(wrapper);
    wrapper.addEventListener('click', event => { if (event.target === wrapper || event.target.closest('[data-modal-close]')) closeModal(); });
    return wrapper.querySelector('#appMgmtModalForm');
  }

  function openPointsModal(client) {
    const form = modalShell(
      `Баллы · ${client.name}`,
      `Текущий баланс: ${points(client.loyaltyBalance)}. Положительное число начисляет, отрицательное списывает.`,
      `<label class="app-mgmt-field">Изменение баланса<input name="amount" type="number" step="1" placeholder="например +500 или -200" required></label>
       <label class="app-mgmt-field">Причина<input name="reason" type="text" maxlength="500" placeholder="например компенсация / ручное начисление" required></label>`,
      'Применить'
    );
    form?.addEventListener('submit', async event => {
      event.preventDefault();
      const formData = new FormData(form);
      const amount = Number(formData.get('amount'));
      const reason = String(formData.get('reason') || '').trim();
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      try {
        await adminRequest('adjustPoints', { clientId: client.id, amount, reason });
        closeModal();
        setNotice(`${amount > 0 ? 'Начислено' : 'Списано'} ${points(Math.abs(amount))} баллов: ${client.name}.`);
        await loadOverview({ syncLocal: false });
      } catch (error) {
        submit.disabled = false;
        const old = form.querySelector('.app-mgmt-error');
        old?.remove();
        form.insertAdjacentHTML('afterbegin', `<div class="app-mgmt-error">${escapeHtml(error.message)}</div>`);
      }
    });
  }

  function openBanModal(client) {
    const banned = !!client.banned;
    const form = modalShell(
      `${banned ? 'Unban' : 'Ban'} · ${client.name}`,
      banned ? `Разблокировать Telegram ID ${client.telegramUserId}?` : `После блокировки Telegram ID ${client.telegramUserId} не сможет создавать новые записи через Mini App.`,
      banned ? '' : '<label class="app-mgmt-field">Причина<input name="reason" type="text" maxlength="500" placeholder="Причина блокировки"></label>',
      banned ? 'Разблокировать' : 'Заблокировать',
      !banned
    );
    form?.addEventListener('submit', async event => {
      event.preventDefault();
      const reason = banned ? '' : String(new FormData(form).get('reason') || '').trim();
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      try {
        await adminRequest('setBan', { telegramUserId: Number(client.telegramUserId), banned: !banned, reason });
        closeModal();
        setNotice(`${client.name}: ${banned ? 'доступ восстановлен' : 'доступ к Mini App ограничен'}.`);
        await loadOverview({ syncLocal: false });
      } catch (error) {
        submit.disabled = false;
        form.insertAdjacentHTML('afterbegin', `<div class="app-mgmt-error">${escapeHtml(error.message)}</div>`);
      }
    });
  }

  root.addEventListener('click', event => {
    const nativeNav = event.target.closest('.nav button:not(.app-mgmt-nav-button), .mobile-tabs button:not(.app-mgmt-nav-button)');
    if (!nativeNav) return;
    ui.active = false;
    closeModal();
  }, true);

  const observer = new MutationObserver(() => {
    if (!document.querySelector('.app-shell')) {
      ui.active = false;
      return;
    }
    ensureButtons();
    if (ui.active && !contentNode()?.querySelector('.app-management-screen')) renderCurrent();
  });
  observer.observe(root, { childList: true, subtree: true });
  ensureButtons();
})();
