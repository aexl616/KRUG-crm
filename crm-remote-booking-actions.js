(() => {
  'use strict';

  const TOKEN_KEY = 'krug-app-admin-token';
  const API_URL = '/api/app-admin';
  const localStatus = {
    request: 'заявка',
    confirmed: 'подтверждено',
    in_progress: 'в процессе',
    completed: 'завершено',
    cancelled: 'отменено'
  };
  const actionByStatus = {
    'подтверждено': 'confirmBooking',
    'в процессе': 'startBooking',
    'отменено': 'cancelBooking'
  };
  let pending = new Set();

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  function findBooking(localId) {
    if (typeof state === 'undefined' || !Array.isArray(state.bookings)) return null;
    return state.bookings.find(row => row.id === localId) || null;
  }

  function isRemote(booking) {
    return booking?.source === 'miniapp' && Boolean(booking.miniAppBookingId);
  }

  async function request(action, payload = {}) {
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    if (!token) throw new Error('Нужен ключ управления Mini App. Открой раздел Mini App и авторизуйся.');
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ action, ...payload })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.message || 'Не удалось обновить запись на сервере.');
    return result.data || {};
  }

  function applyServerResult(booking, result) {
    if (!booking || !result || typeof result !== 'object') return;
    const previousStatus = booking.status;
    if (result.status && localStatus[result.status]) booking.status = localStatus[result.status];
    if (result.paymentStatus != null) booking.paymentStatus = String(result.paymentStatus);
    if (result.paidAmount != null) booking.paidAmount = Number(result.paidAmount || 0);
    if (result.paymentMethod != null) booking.paymentMethod = String(result.paymentMethod || '');
    if (result.bonusReserved != null) booking.bonusReserved = Number(result.bonusReserved || 0);
    if (result.bonusSpent != null) booking.bonusSpent = Number(result.bonusSpent || 0);
    if (result.amountDue != null) booking.amountDue = Number(result.amountDue || 0);
    if (result.loyaltyBalance != null) booking.loyaltyBalance = Number(result.loyaltyBalance || 0);
    if (booking.status !== previousStatus && typeof appendStatusHistory === 'function') {
      appendStatusHistory(booking, booking.status, 'сохранено в Mini App');
    }
  }

  function commitServerResult(booking, result) {
    applyServerResult(booking, result);
    if (typeof saveState === 'function') saveState();
    if (typeof render === 'function') render();
    document.dispatchEvent(new CustomEvent('krug:miniapp-refresh'));
  }

  function showError(error) {
    alert(error?.message || 'Не удалось обновить запись.');
  }

  async function mutate(button, booking, action) {
    const remoteId = String(booking.miniAppBookingId || '');
    if (!remoteId || pending.has(remoteId)) return;
    pending.add(remoteId);
    if (button) button.disabled = true;
    try {
      const result = await request(action, { bookingId: remoteId });
      commitServerResult(booking, result);
    } catch (error) {
      if (button?.isConnected) button.disabled = false;
      showError(error);
    } finally {
      pending.delete(remoteId);
    }
  }

  function openSettlement(booking) {
    const remoteId = String(booking.miniAppBookingId || '');
    if (!remoteId || pending.has(remoteId)) return;
    document.querySelector('.krug-remote-settlement')?.remove();

    const defaultPaid = Math.max(0, Number(booking.amountDue ?? booking.amount ?? 0));
    const wrap = document.createElement('div');
    wrap.className = 'app-mgmt-modal-backdrop krug-remote-settlement';
    wrap.innerHTML = `<form class="app-mgmt-modal">
      <h3>Завершить сессию</h3>
      <p>Зафиксируй фактически полученную сумму. Оплата проходит на студии; после сохранения сервер завершит запись и проведёт бонусы.</p>
      <div class="app-mgmt-modal-fields">
        <label class="app-mgmt-field">Получено, ₽<input name="paidAmount" type="number" min="0" max="10000000" step="1" value="${esc(defaultPaid)}" required></label>
        <label class="app-mgmt-field">Способ оплаты<select name="paymentMethod"><option>Наличные</option><option>Перевод</option><option>Карта</option><option>Другое</option></select></label>
      </div>
      <div class="app-mgmt-modal-actions"><button type="button" class="app-mgmt-btn ghost" data-remote-settlement-close>Отмена</button><button type="submit" class="app-mgmt-btn primary">Оплачено · завершить</button></div>
    </form>`;
    document.body.appendChild(wrap);

    const close = () => wrap.remove();
    wrap.addEventListener('click', event => {
      if (event.target === wrap || event.target.closest('[data-remote-settlement-close]')) close();
    });
    wrap.querySelector('form')?.addEventListener('submit', async event => {
      event.preventDefault();
      if (pending.has(remoteId)) return;
      const submit = event.currentTarget.querySelector('[type="submit"]');
      const form = new FormData(event.currentTarget);
      const paidAmount = Number(form.get('paidAmount'));
      const paymentMethod = String(form.get('paymentMethod') || 'На студии').trim();
      if (!Number.isSafeInteger(paidAmount) || paidAmount < 0) {
        showError(new Error('Проверь фактически полученную сумму.'));
        return;
      }
      pending.add(remoteId);
      submit.disabled = true;
      try {
        const result = await request('settleBooking', { bookingId: remoteId, paidAmount, paymentMethod });
        close();
        commitServerResult(booking, result);
      } catch (error) {
        submit.disabled = false;
        showError(error);
      } finally {
        pending.delete(remoteId);
      }
    });
  }

  document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-side-status-booking]');
    if (!button) return;
    const booking = findBooking(button.dataset.sideStatusBooking);
    if (!isRemote(booking)) return;

    // Stop the legacy localStorage-only handler. A Mini App booking may change
    // state only after the server accepts the transition.
    event.preventDefault();
    event.stopImmediatePropagation();

    const targetStatus = String(button.dataset.status || '');
    if (targetStatus === 'завершено') {
      openSettlement(booking);
      return;
    }
    const action = actionByStatus[targetStatus];
    if (!action) return;
    if (targetStatus === 'отменено' && !confirm('Отменить эту запись?')) return;
    mutate(button, booking, action);
  }, true);
})();
