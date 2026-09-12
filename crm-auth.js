(() => {
  'use strict';

  const SESSION_KEY = 'krug-crm-session-v1';
  const SESSION_USER_KEY = 'krug-crm-session-user-v1';
  const VERSION_KEY = 'krug-crm-cloud-version-v1';
  const API_URL = '/api/crm-auth';
  const STATIC_PREVIEW = /\.github\.io$/i.test(location.hostname);
  let validating = false;
  let passwordDialogPromise = null;

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
      state.payments = [];
      state.expenses = [];
      state.payouts = [];
    }
    return user;
  }

  async function request(action, payload = {}, { auth = true, tokenOverride = '' } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    const authToken = tokenOverride || sessionToken();
    if (auth) headers.Authorization = `Bearer ${authToken}`;
    const response = await fetch(API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action, ...payload })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      const error = new Error(result.message || 'Не удалось выполнить запрос CRM.');
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
      if (grid?.parentNode) grid.parentNode.insertBefore(node, grid);
      else form.prepend(node);
    }
    node.textContent = message;
    node.hidden = !message;
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

  function ensurePasswordDialog() {
    let dialog = document.getElementById('crmPasswordRotateDialog');
    if (dialog) return dialog;

    const style = document.createElement('style');
    style.textContent = `
      #crmPasswordRotateDialog{width:min(440px,calc(100vw - 32px));border:1px solid #3a3a3a;border-radius:18px;background:#171717;color:#f2f2f2;padding:0;box-shadow:0 24px 80px #000b}
      #crmPasswordRotateDialog::backdrop{background:#000c;backdrop-filter:blur(6px)}
      .crm-password-card{padding:24px;display:grid;gap:16px}
      .crm-password-card h2{margin:0;font-size:24px}.crm-password-card p{margin:0;color:#9a9a9a;line-height:1.5}
      .crm-password-card label{display:grid;gap:8px;font-size:13px;color:#b7b7b7}.crm-password-card input{width:100%;min-height:48px;border:1px solid #383838;border-radius:12px;background:#111;color:#fff;padding:0 14px}
      .crm-password-error{min-height:20px;color:#ff9476;font-size:13px}.crm-password-card .btn{width:100%}
    `;
    document.head.append(style);

    dialog = document.createElement('dialog');
    dialog.id = 'crmPasswordRotateDialog';
    dialog.innerHTML = `
      <form class="crm-password-card" method="dialog">
        <div><h2>Смени временный пароль</h2><p>Первый вход использует старый пароль из локальной CRM. Задай новый — он будет храниться только как серверный хеш.</p></div>
        <label>Новый пароль<input name="password" type="password" autocomplete="new-password" minlength="10" maxlength="200" required></label>
        <label>Повтори пароль<input name="repeat" type="password" autocomplete="new-password" minlength="10" maxlength="200" required></label>
        <div class="crm-password-error" role="alert"></div>
        <button class="btn" type="submit">Сохранить новый пароль</button>
      </form>`;
    dialog.addEventListener('cancel', event => event.preventDefault());
    document.body.append(dialog);
    return dialog;
  }

  function requirePasswordChange(user) {
    if (!user?.mustChangePassword) return Promise.resolve(user);
    if (passwordDialogPromise) return passwordDialogPromise;
    const dialog = ensurePasswordDialog();
    const form = dialog.querySelector('form');
    const errorNode = dialog.querySelector('.crm-password-error');
    form.reset();
    errorNode.textContent = '';
    dialog.showModal();

    passwordDialogPromise = new Promise((resolve, reject) => {
      const submit = async event => {
        event.preventDefault();
        const password = String(form.elements.password.value || '');
        const repeat = String(form.elements.repeat.value || '');
        if (password.length < 10) { errorNode.textContent = 'Минимум 10 символов.'; return; }
        if (password !== repeat) { errorNode.textContent = 'Пароли не совпадают.'; return; }
        const button = form.querySelector('[type="submit"]');
        button.disabled = true;
        button.textContent = 'Сохраняем…';
        errorNode.textContent = '';
        try {
          const result = await request('changePassword', { password });
          const nextUser = result?.user || { ...user, mustChangePassword: false };
          sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(nextUser));
          dialog.close();
          form.removeEventListener('submit', submit);
          passwordDialogPromise = null;
          resolve(nextUser);
        } catch (error) {
          errorNode.textContent = error.message || 'Не удалось сменить пароль.';
        } finally {
          if (button.isConnected) { button.disabled = false; button.textContent = 'Сохранить новый пароль'; }
        }
      };
      form.addEventListener('submit', submit);
      dialog.addEventListener('close', () => {
        if (user?.mustChangePassword && passwordDialogPromise) {
          // Closing is normally only possible after a successful change.
          if (dialog.returnValue === 'cancel') reject(new Error('Смена пароля обязательна.'));
        }
      }, { once: true });
    });
    return passwordDialogPromise;
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

  async function finishLogin(remoteUser) {
    const securedUser = await requirePasswordChange(remoteUser);
    const local = syncLocalUser(securedUser);
    if (!local) throw new Error('Не удалось открыть профиль сотрудника.');
    if (typeof switchLocalUser === 'function') switchLocalUser(local.id);
    else {
      state.sessionUserId = local.id;
      if (typeof saveState === 'function') saveState();
      if (typeof render === 'function') render();
    }
    sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(securedUser));
    document.dispatchEvent(new CustomEvent('krug:crm-auth', { detail: { action: 'login', user: clone(securedUser) } }));
    setTimeout(() => window.KrugCloudState?.reset?.(), 0);
    return securedUser;
  }

  async function login(loginValue, passwordValue) {
    const data = await request('login', { login: loginValue, password: passwordValue }, { auth: false });
    if (!data?.token || !data?.user) throw new Error('Сервер не вернул сессию CRM.');
    sessionStorage.setItem(SESSION_KEY, String(data.token));
    sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(data.user));
    sessionStorage.removeItem(VERSION_KEY);
    try {
      return await finishLogin(data.user);
    } catch (error) {
      clearSession();
      throw error;
    }
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
      const securedUser = await requirePasswordChange(data.user);
      const local = syncLocalUser(securedUser);
      sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(securedUser));
      if (local && state.sessionUserId !== local.id) {
        state.sessionUserId = local.id;
        if (typeof saveState === 'function') saveState();
      }
      if (typeof render === 'function') render();
      document.dispatchEvent(new CustomEvent('krug:crm-auth', { detail: { action: 'session', user: clone(securedUser) } }));
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
    if (token) request('logout', {}, { tokenOverride: token }).catch(() => {});
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_USER_KEY);
    sessionStorage.removeItem(VERSION_KEY);
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
