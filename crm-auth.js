(() => {
  'use strict';

  const SESSION_KEY = 'krug-crm-session-v1';
  const SESSION_USER_KEY = 'krug-crm-session-user-v1';
  const VERSION_KEY = 'krug-crm-cloud-version-v1';
  const API_URL = '/api/crm-auth';
  const STATIC_PREVIEW = /\.github\.io$/i.test(location.hostname);
  let validating = false;

  const sessionToken = () => sessionStorage.getItem(SESSION_KEY) || '';
  const clone = value => JSON.parse(JSON.stringify(value));

  function rolePosition(role) {
    return role === 'owner' ? 'Владелец' : role === 'admin' ? 'Администратор' : role === 'engineer' ? 'Звукорежиссёр' : 'Сотрудник';
  }

  function syncLocalUser(remote) {
    if (!remote || typeof state === 'undefined' || !Array.isArray(state.users)) return null;
    let user = state.users.find(item => item.id === remote.id);
    if (!user) {
      user = {
        id: remote.id,
        name: remote.name,
        login: remote.login || remote.id,
        password: '',
        role: remote.role,
        position: rolePosition(remote.role),
        percent: 0,
        fixedRate: 0,
        color: '#ff6633',
        phone: '',
        telegram: '',
        active: true
      };
      state.users.push(user);
    } else {
      user.name = remote.name || user.name;
      user.login = remote.login || user.login;
      user.role = remote.role || user.role;
      user.position = rolePosition(user.role);
      user.active = true;
    }
    if (!['owner','admin'].includes(user.role)) {
      // Finance is never kept in the restricted user's local cache. The server
      // also excludes these collections, so role switching cannot leak revenue.
      state.payments = [];
      state.expenses = [];
      state.payouts = [];
    }
    return user;
  }

  async function request(action, payload = {}, { auth = true } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth) headers.Authorization = `Bearer ${sessionToken()}`;
    const response = await fetch(API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action, ...payload })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      const error = new Error(result.message || 'Не удалось войти в CRM.');
      error.code = result.error || `HTTP_${response.status}`;
      error.status = response.status;
      throw error;
    }
    return result.data;
  }

  function showLoginError(message) {
    const form = document.querySelector('#loginForm');
    if (!form) return;
    let node = form.querySelector('.crm-server-auth-error');
    if (!node) {
      node = document.createElement('div');
      node.className = 'access-notice crm-server-auth-error';
      node.setAttribute('role', 'alert');
      const grid = form.querySelector('.grid');
      (grid || form).before?.(node);
      if (!node.isConnected) form.prepend(node);
    }
    node.textContent = message;
  }

  function hardenLoginForm() {
    if (STATIC_PREVIEW) return;
    const form = document.querySelector('#loginForm');
    if (!form || form.dataset.serverAuthReady) return;
    form.dataset.serverAuthReady = 'true';
    const login = form.elements.login;
    const password = form.elements.password;
    if (login?.value === 'admin') login.value = '';
    if (password) password.value = '';
    if (login) login.setAttribute('autocomplete', 'username');
    if (password) password.setAttribute('autocomplete', 'current-password');
    const muted = form.querySelector('.muted');
    if (muted) muted.textContent = 'Вход для сотрудников КРУГ.';
  }

  function clearSession({ renderLogin = true } = {}) {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_USER_KEY);
    sessionStorage.removeItem(VERSION_KEY);
    if (typeof state !== 'undefined') state.sessionUserId = null;
    try { if (typeof saveState === 'function') saveState(); } catch {}
    if (renderLogin) {
      try { if (typeof render === 'function') render(); } catch {}
      queueMicrotask(hardenLoginForm);
    }
  }

  async function login(loginValue, passwordValue) {
    const data = await request('login', { login: loginValue, password: passwordValue }, { auth: false });
    if (!data?.token || !data?.user) throw new Error('Сервер не вернул сессию CRM.');
    sessionStorage.setItem(SESSION_KEY, String(data.token));
    sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(data.user));
    sessionStorage.removeItem(VERSION_KEY);
    const local = syncLocalUser(data.user);
    if (!local) throw new Error('Не удалось открыть профиль сотрудника.');
    if (typeof switchLocalUser === 'function') switchLocalUser(local.id);
    else {
      state.sessionUserId = local.id;
      if (typeof saveState === 'function') saveState();
      if (typeof render === 'function') render();
    }
    document.dispatchEvent(new CustomEvent('krug:crm-auth', { detail: { action: 'login', user: clone(data.user) } }));
    setTimeout(() => window.KrugCloudState?.reset?.(), 0);
    return data.user;
  }

  async function validateSession() {
    if (STATIC_PREVIEW || validating) return;
    const token = sessionToken();
    if (!token) {
      if (typeof currentUser === 'function' && currentUser()) clearSession();
      else hardenLoginForm();
      return;
    }
    validating = true;
    try {
      const data = await request('session');
      const local = syncLocalUser(data.user);
      sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(data.user));
      if (local && state.sessionUserId !== local.id) {
        state.sessionUserId = local.id;
        if (typeof saveState === 'function') saveState();
      }
      if (typeof render === 'function') render();
      document.dispatchEvent(new CustomEvent('krug:crm-auth', { detail: { action: 'session', user: clone(data.user) } }));
    } catch (error) {
      if (error.status === 401) clearSession();
      else console.warn('[KRUG CRM] session validation failed', error.code || error.message);
    } finally {
      validating = false;
      queueMicrotask(hardenLoginForm);
    }
  }

  document.addEventListener('submit', event => {
    if (STATIC_PREVIEW || event.target?.id !== 'loginForm') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const form = event.target;
    const data = Object.fromEntries(new FormData(form));
    const button = form.querySelector('[type="submit"]');
    if (button) { button.disabled = true; button.dataset.originalText ||= button.textContent; button.textContent = 'Входим…'; }
    showLoginError('');
    login(String(data.login || '').trim(), String(data.password || ''))
      .catch(error => showLoginError(error.message || 'Не удалось войти.'))
      .finally(() => {
        if (button?.isConnected) { button.disabled = false; button.textContent = button.dataset.originalText || 'Войти'; }
      });
  }, true);

  document.addEventListener('click', event => {
    if (STATIC_PREVIEW) return;
    const ownerReturn = event.target.closest?.('[data-action="returnOwner"]');
    if (ownerReturn) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    const logout = event.target.closest?.('[data-action="logout"]');
    if (!logout) return;
    const token = sessionToken();
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_USER_KEY);
    sessionStorage.removeItem(VERSION_KEY);
    if (token) request('logout').catch(() => {});
  }, true);

  const observer = new MutationObserver(() => {
    hardenLoginForm();
    if (!STATIC_PREVIEW) document.querySelectorAll('[data-action="returnOwner"]').forEach(node => node.remove());
  });
  observer.observe(document.getElementById('app') || document.body, { childList: true, subtree: true });

  window.KrugCrmAuth = {
    sessionToken,
    login,
    validateSession,
    logout: () => clearSession(),
    preview: STATIC_PREVIEW
  };

  hardenLoginForm();
  setTimeout(validateSession, 0);
})();
