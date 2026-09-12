(() => {
  'use strict';

  const API_URL = '/api/crm-auth';
  const STATIC_PREVIEW = /\.github\.io$/i.test(location.hostname);
  let reconciling = false;

  const token = () => window.KrugCrmAuth?.sessionToken?.() || '';
  const managedRole = () => {
    try { return ['owner','admin'].includes(currentRole?.()); }
    catch { return false; }
  };
  const positionForRole = role => role === 'owner' ? 'Владелец' : role === 'admin' ? 'Администратор' : role === 'engineer' ? 'Звукорежиссёр' : 'Сотрудник';

  async function request(action, payload = {}) {
    const auth = token();
    if (!auth) throw Object.assign(new Error('Войди в CRM заново.'), { status: 401 });
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth}` },
      body: JSON.stringify({ action, ...payload })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      const error = new Error(result.message || 'Не удалось обновить сотрудников.');
      error.code = result.error || `HTTP_${response.status}`;
      error.status = response.status;
      if (response.status === 401) setTimeout(() => window.KrugCrmAuth?.logout?.(), 0);
      throw error;
    }
    return result.data;
  }

  function mergeServerUser(remote, metadata = {}) {
    if (!remote || typeof state === 'undefined' || !Array.isArray(state.users)) return null;
    const existing = state.users.find(user => user.id === remote.id);
    const next = {
      ...(existing || {}),
      ...metadata,
      id: remote.id,
      name: remote.name,
      login: remote.login,
      password: '',
      role: remote.role,
      position: metadata.position || existing?.position || positionForRole(remote.role),
      percent: Number(existing?.percent || metadata.percent || 0),
      fixedRate: Number(existing?.fixedRate || metadata.fixedRate || 0),
      color: metadata.color || existing?.color || '#ff6633',
      phone: metadata.phone ?? existing?.phone ?? '',
      telegram: metadata.telegram ?? existing?.telegram ?? '',
      active: remote.active !== false,
      serverManaged: true,
      mustChangePassword: !!remote.mustChangePassword
    };
    if (existing) state.users = state.users.map(user => user.id === remote.id ? next : user);
    else state.users.push(next);
    return next;
  }

  function scrubPlaintextPasswords() {
    if (STATIC_PREVIEW || typeof state === 'undefined' || !Array.isArray(state.users)) return false;
    let changed = false;
    state.users.forEach(user => {
      if (user.password) { user.password = ''; changed = true; }
    });
    return changed;
  }

  async function reconcileStaff({ renderAfter = false } = {}) {
    if (STATIC_PREVIEW || reconciling || !token() || !managedRole()) {
      if (scrubPlaintextPasswords()) try { saveState(); } catch {}
      return [];
    }
    reconciling = true;
    try {
      const rows = await request('staffList');
      const serverIds = new Set((rows || []).map(row => String(row.id)));
      (rows || []).forEach(row => mergeServerUser(row));
      state.users.forEach(user => {
        user.password = '';
        if (!serverIds.has(String(user.id)) && user.id !== state.sessionUserId) {
          // Keep historical employee metadata for old bookings, but it is no longer a login account.
          user.active = false;
          user.serverManaged = false;
        }
      });
      if (typeof saveState === 'function') saveState();
      if (renderAfter && typeof render === 'function') render();
      return rows || [];
    } catch (error) {
      if (error.status !== 403) console.warn('[KRUG CRM] staff reconcile failed', error.code || error.message);
      return [];
    } finally {
      reconciling = false;
    }
  }

  function busy(button, value, text = 'Сохраняем…') {
    if (!button) return;
    if (value) {
      button.dataset.staffOriginalText ||= button.textContent;
      button.disabled = true;
      button.textContent = text;
    } else {
      button.disabled = false;
      button.textContent = button.dataset.staffOriginalText || button.textContent;
    }
  }

  document.addEventListener('submit', event => {
    if (STATIC_PREVIEW || event.target?.id !== 'userForm') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!managedRole()) return;
    const form = event.target;
    const data = Object.fromEntries(new FormData(form));
    const submit = form.querySelector('[type="submit"]');
    busy(submit, true, 'Создаём…');
    request('staffCreate', {
      name: String(data.name || '').trim(),
      login: String(data.login || '').trim(),
      password: String(data.password || ''),
      role: String(data.role || 'staff')
    }).then(remote => {
      mergeServerUser(remote, {
        position: data.position || positionForRole(remote.role),
        color: data.color || '#ff6633',
        phone: String(data.phone || '').trim(),
        telegram: String(data.telegram || '').trim(),
        payoutMode: state.settings?.payouts?.calculationMode,
        payoutPercent: 0, payoutHourlyRate: 0, payoutFixedAmount: 0,
        percent: 0, fixedRate: 0
      });
      if (typeof saveState === 'function') saveState();
      if (typeof render === 'function') render();
    }).catch(error => alert(error.message || 'Не удалось создать сотрудника.'))
      .finally(() => busy(submit, false));
  }, true);

  document.addEventListener('click', event => {
    if (STATIC_PREVIEW) return;
    const save = event.target.closest?.('[data-save-user]');
    if (save) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!managedRole()) return;
      const id = save.dataset.saveUser;
      const row = document.querySelector(`[data-user-row="${CSS.escape(id)}"]`);
      if (!row) return;
      const data = Object.fromEntries(new FormData(row));
      busy(save, true);
      request('staffUpdate', {
        userId: id,
        name: String(data.name || '').trim(),
        role: String(data.role || 'staff'),
        active: data.active === 'on'
      }).then(remote => {
        const previous = state.users.find(user => user.id === id) || {};
        mergeServerUser(remote, {
          position: data.positionRole || data.position || previous.position,
          color: data.color || previous.color,
          phone: String(data.phone || ''),
          telegram: String(data.telegram || '')
        });
        if (typeof saveState === 'function') saveState();
        if (typeof render === 'function') render();
      }).catch(error => alert(error.message || 'Не удалось сохранить сотрудника.'))
        .finally(() => busy(save, false));
      return;
    }

    const remove = event.target.closest?.('[data-remove-user]');
    if (!remove) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!managedRole()) return;
    const id = remove.dataset.removeUser;
    const user = state.users.find(item => item.id === id);
    if (!user) return;
    if (user.role === 'owner') { alert('Владельца нельзя удалить.'); return; }
    if (state.bookings.some(booking => booking.employeeId === user.id || booking.employee === user.name)
      || state.payments.some(payment => [payment.employee, payment.soundEngineer, payment.performer].includes(user.name))) {
      alert('Сотрудник уже используется в записях или платежах. Его можно отключить, но не удалить.');
      return;
    }
    if (!confirm(`Удалить сотрудника «${user.name}»?`)) return;
    busy(remove, true, 'Удаляем…');
    request('staffDelete', { userId: id }).then(() => {
      state.users = state.users.filter(item => item.id !== id);
      if (typeof saveState === 'function') saveState();
      if (typeof render === 'function') render();
    }).catch(error => alert(error.message || 'Не удалось удалить сотрудника.'))
      .finally(() => busy(remove, false));
  }, true);

  document.addEventListener('krug:crm-auth', () => setTimeout(() => reconcileStaff({renderAfter:true}), 0));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) reconcileStaff().catch(() => {}); });

  // Never retain legacy plaintext CRM passwords in production localStorage.
  setTimeout(() => {
    if (scrubPlaintextPasswords()) try { saveState(); } catch {}
    reconcileStaff({renderAfter:false}).catch(() => {});
  }, 50);

  window.KrugStaffSync = { reconcile: reconcileStaff };
})();
