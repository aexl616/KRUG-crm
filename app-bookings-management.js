(() => {
  'use strict';

  const root = document.getElementById('app');
  const TOKEN_KEY = 'krug-app-admin-token';
  const API_URL = '/api/app-admin';
  if (!root) return;

  let loading = false;
  let lastLoadedAt = 0;

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
  const money = value => `${new Intl.NumberFormat('ru-RU').format(Number(value) || 0)} ₽`;
  const statusLabel = status => ({ request:'Ожидает подтверждения', confirmed:'Подтверждено', in_progress:'Сессия идёт', completed:'Завершено', cancelled:'Отменено' }[status] || status);

  async function request(action, payload = {}) {
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    if (!token) throw new Error('Нужен ключ управления Mini App.');
    const response = await fetch(API_URL, {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
      body:JSON.stringify({ action, ...payload })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.message || 'Не удалось выполнить операцию.');
    return result.data;
  }

  function bookingStart(row) {
    return new Date(`${row.date}T${row.startTime}:00+03:00`).getTime();
  }

  function renderRows(rows) {
    const active = rows.filter(row => row.status !== 'cancelled').slice(0, 40);
    if (!active.length) return '<div class="app-mgmt-empty">Заявок Mini App пока нет.</div>';
    return `<div class="app-booking-list">${active.map(row => {
      const canSettle = row.paymentStatus !== 'paid' && Date.now() >= bookingStart(row) && row.status !== 'completed';
      return `<article class="app-booking-row" data-booking-id="${escapeHtml(row.id)}">
        <div class="app-booking-main">
          <small>${escapeHtml(row.date)} · ${escapeHtml(row.startTime)}–${escapeHtml(row.endTime)}</small>
          <strong>${escapeHtml(row.serviceName)}</strong>
          <span>${escapeHtml(row.clientName)} · ${escapeHtml(row.phone || 'без телефона')}</span>
          ${row.comment ? `<em>${escapeHtml(row.comment)}</em>` : ''}
        </div>
        <div class="app-booking-money">
          <strong>${money(row.price)}</strong>
          ${Number(row.bonusReserved) > 0 ? `<small>${escapeHtml(row.bonusReserved)} баллов в резерве · к оплате ${money(row.amountDue)}</small>` : `<small>к оплате ${money(row.amountDue)}</small>`}
          <span class="app-mgmt-badge ${row.status === 'completed' ? 'green' : row.status === 'request' ? 'orange' : ''}">${escapeHtml(statusLabel(row.status))}</span>
        </div>
        <div class="app-booking-actions">
          ${row.status === 'request' ? `<button class="app-mgmt-btn primary" data-booking-confirm="${escapeHtml(row.id)}">Подтвердить</button>` : ''}
          ${canSettle ? `<button class="app-mgmt-btn primary" data-booking-settle="${escapeHtml(row.id)}" data-default-paid="${escapeHtml(row.amountDue)}">Оплата / закрыть</button>` : ''}
          ${['request','confirmed','in_progress'].includes(row.status) ? `<button class="app-mgmt-btn danger" data-booking-cancel="${escapeHtml(row.id)}">Отменить</button>` : ''}
          ${row.paymentStatus === 'paid' ? `<small>Оплачено ${money(row.paidAmount)}${row.paymentMethod ? ` · ${escapeHtml(row.paymentMethod)}` : ''}</small>` : ''}
        </div>
      </article>`;
    }).join('')}</div>`;
  }

  async function load(panel, force = false) {
    if (loading || !panel?.isConnected) return;
    if (!force && Date.now() - lastLoadedAt < 5000 && panel.dataset.loaded === 'true') return;
    loading = true;
    panel.innerHTML = '<div class="app-mgmt-section-head"><div><h2>Заявки Mini App</h2><p>Реальные бронирования из Supabase. Деньги фиксируются только после прихода клиента на студию.</p></div></div><div class="app-mgmt-empty">Загружаем записи…</div>';
    try {
      const rows = await request('bookingsOverview');
      if (!panel.isConnected) return;
      panel.innerHTML = '<div class="app-mgmt-section-head"><div><h2>Заявки Mini App</h2><p>Подтверждение, отмена и фактическая оплата на студии. Закрытие оплаченной сессии автоматически проводит баллы.</p></div><button class="app-mgmt-btn ghost" data-bookings-refresh>Обновить</button></div>' + renderRows(Array.isArray(rows) ? rows : []);
      panel.dataset.loaded = 'true';
      lastLoadedAt = Date.now();
      bindPanel(panel);
    } catch (error) {
      if (panel.isConnected) panel.innerHTML = `<div class="app-mgmt-section-head"><div><h2>Заявки Mini App</h2></div></div><div class="app-mgmt-error">${escapeHtml(error.message)}</div><button class="app-mgmt-btn ghost" data-bookings-refresh>Повторить</button>`;
      bindPanel(panel);
    } finally {
      loading = false;
    }
  }

  function showSettlement(bookingId, defaultPaid) {
    document.querySelector('.app-booking-modal-backdrop')?.remove();
    const wrap = document.createElement('div');
    wrap.className = 'app-mgmt-modal-backdrop app-booking-modal-backdrop';
    wrap.innerHTML = `<form class="app-mgmt-modal" id="appBookingSettlement">
      <h3>Оплата на студии</h3>
      <p>Укажи фактически полученную сумму. После сохранения запись будет завершена, резерв баллов спишется, а новые баллы начислятся по текущему проценту.</p>
      <div class="app-mgmt-modal-fields">
        <label class="app-mgmt-field">Получено, ₽<input name="paidAmount" type="number" min="0" step="1" value="${escapeHtml(defaultPaid)}" required></label>
        <label class="app-mgmt-field">Способ оплаты<select name="paymentMethod"><option>Наличные</option><option>Перевод</option><option>Карта</option><option>Другое</option></select></label>
      </div>
      <div class="app-mgmt-modal-actions"><button type="button" class="app-mgmt-btn ghost" data-close-settlement>Отмена</button><button type="submit" class="app-mgmt-btn primary">Оплачено · закрыть</button></div>
    </form>`;
    document.body.appendChild(wrap);
    const close = () => wrap.remove();
    wrap.addEventListener('click', event => { if (event.target === wrap || event.target.closest('[data-close-settlement]')) close(); });
    wrap.querySelector('form')?.addEventListener('submit', async event => {
      event.preventDefault();
      const submit = event.currentTarget.querySelector('[type="submit"]');
      submit.disabled = true;
      try {
        const form = new FormData(event.currentTarget);
        await request('settleBooking', { bookingId, paidAmount:Number(form.get('paidAmount')), paymentMethod:String(form.get('paymentMethod') || 'На студии') });
        close();
        document.querySelector('#appMgmtRefresh')?.click();
      } catch (error) {
        submit.disabled = false;
        event.currentTarget.querySelector('.app-mgmt-error')?.remove();
        event.currentTarget.insertAdjacentHTML('afterbegin', `<div class="app-mgmt-error">${escapeHtml(error.message)}</div>`);
      }
    });
  }

  function bindPanel(panel) {
    panel.querySelector('[data-bookings-refresh]')?.addEventListener('click', () => load(panel, true));
    panel.querySelectorAll('[data-booking-confirm]').forEach(button => button.addEventListener('click', async () => {
      button.disabled = true;
      try { await request('confirmBooking', { bookingId:button.dataset.bookingConfirm }); await load(panel, true); }
      catch (error) { button.disabled = false; alert(error.message); }
    }));
    panel.querySelectorAll('[data-booking-settle]').forEach(button => button.addEventListener('click', () => showSettlement(button.dataset.bookingSettle, button.dataset.defaultPaid)));
    panel.querySelectorAll('[data-booking-cancel]').forEach(button => button.addEventListener('click', async () => {
      if (!confirm('Отменить эту запись?')) return;
      button.disabled = true;
      try { await request('cancelBooking', { bookingId:button.dataset.bookingCancel }); await load(panel, true); document.querySelector('#appMgmtRefresh')?.click(); }
      catch (error) { button.disabled = false; alert(error.message); }
    }));
  }

  function ensurePanel() {
    const screen = root.querySelector('.app-management-screen');
    if (!screen || !sessionStorage.getItem(TOKEN_KEY)) return;
    if (screen.querySelector('#appMgmtBookingsPanel')) return;
    const policy = screen.querySelector('#appMgmtPolicyForm')?.closest('.app-mgmt-card');
    const panel = document.createElement('section');
    panel.id = 'appMgmtBookingsPanel';
    panel.className = 'app-mgmt-card';
    if (policy?.nextSibling) policy.parentNode.insertBefore(panel, policy.nextSibling); else screen.appendChild(panel);
    load(panel, true);
  }

  const observer = new MutationObserver(() => queueMicrotask(ensurePanel));
  observer.observe(root, { childList:true, subtree:true });
  ensurePanel();
})();
