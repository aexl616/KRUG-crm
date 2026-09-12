(() => {
  'use strict';

  const TOKEN_KEY = 'krug-app-admin-token';
  const API_URL = '/api/crm-state';
  const COLLECTIONS = ['clients','bookings','payments','expenses','payouts','studioBlocks'];
  const VERSION_KEY = 'krug-crm-cloud-version-v1';
  let cloudVersion = Number(sessionStorage.getItem(VERSION_KEY) || 0);
  let syncing = false;
  let bootstrapped = false;
  let pushTimer = null;
  const baseSaveState = typeof saveState === 'function' ? saveState : null;

  const clone = value => JSON.parse(JSON.stringify(value));
  const token = () => sessionStorage.getItem(TOKEN_KEY) || '';
  const actor = () => {
    try { return typeof currentUser === 'function' ? (currentUser()?.name || 'crm') : 'crm'; }
    catch { return 'crm'; }
  };

  function snapshot() {
    const result = {};
    COLLECTIONS.forEach(key => { result[key] = clone(Array.isArray(state?.[key]) ? state[key] : []); });
    return result;
  }

  function applySnapshot(remote) {
    if (!remote || typeof remote !== 'object') return false;
    let changed = false;
    COLLECTIONS.forEach(key => {
      if (!Array.isArray(remote[key])) return;
      const next = clone(remote[key]);
      if (JSON.stringify(state[key] || []) !== JSON.stringify(next)) {
        state[key] = next;
        changed = true;
      }
    });
    return changed;
  }

  async function request(action, payload = {}) {
    const auth = token();
    if (!auth) return null;
    const response = await fetch(API_URL, {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${auth}`},
      body:JSON.stringify({action,...payload})
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      const error = new Error(result.message || 'CRM cloud sync failed');
      error.code = result.error || `HTTP_${response.status}`;
      error.status = response.status;
      throw error;
    }
    return result.data;
  }

  function rememberVersion(version) {
    cloudVersion = Number(version || 0);
    sessionStorage.setItem(VERSION_KEY, String(cloudVersion));
  }

  async function pull({renderAfter=true} = {}) {
    if (!token() || syncing) return false;
    syncing = true;
    try {
      const remote = await request('get');
      if (!remote) return false;
      rememberVersion(remote.version);
      if (Number(remote.version) === 0) return false;
      const changed = applySnapshot(remote.data);
      if (changed && baseSaveState) baseSaveState();
      if (changed && renderAfter && typeof render === 'function') render();
      document.dispatchEvent(new CustomEvent('krug:cloud-state', {detail:{direction:'pull',version:cloudVersion,changed}}));
      return changed;
    } finally { syncing = false; }
  }

  async function push() {
    if (!token() || syncing || typeof state === 'undefined') return false;
    syncing = true;
    try {
      try {
        const remote = await request('put', {expectedVersion:cloudVersion,state:snapshot(),updatedBy:actor()});
        rememberVersion(remote.version);
        document.dispatchEvent(new CustomEvent('krug:cloud-state', {detail:{direction:'push',version:cloudVersion,changed:true}}));
        return true;
      } catch (error) {
        if (error.code !== 'CRM_STATE_CONFLICT') throw error;
        const latest = await request('get');
        rememberVersion(latest.version);
        // Server wins on conflicts in 0.10.0. Explicitly prefer consistency over silent last-write-wins.
        const changed = applySnapshot(latest.data);
        if (changed && baseSaveState) baseSaveState();
        if (changed && typeof render === 'function') render();
        document.dispatchEvent(new CustomEvent('krug:cloud-state', {detail:{direction:'conflict',version:cloudVersion,changed}}));
        return false;
      }
    } finally { syncing = false; }
  }

  function schedulePush() {
    if (!token() || !bootstrapped) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => push().catch(error => console.warn('[KRUG CRM] cloud push failed', error?.code || error?.message || error)), 550);
  }

  async function bootstrap() {
    if (bootstrapped || !token() || typeof state === 'undefined') return;
    bootstrapped = true;
    try {
      const remote = await request('get');
      rememberVersion(remote.version);
      if (Number(remote.version) > 0) {
        const changed = applySnapshot(remote.data);
        if (changed && baseSaveState) baseSaveState();
        if (changed && typeof render === 'function') render();
      } else {
        await push();
      }
      document.dispatchEvent(new CustomEvent('krug:cloud-state', {detail:{direction:'bootstrap',version:cloudVersion,changed:false}}));
    } catch (error) {
      bootstrapped = false;
      console.warn('[KRUG CRM] cloud bootstrap failed', error?.code || error?.message || error);
    }
  }

  if (baseSaveState) {
    saveState = function saveStateWithCloudSync(...args) {
      const result = baseSaveState.apply(this, args);
      schedulePush();
      return result;
    };
  }

  document.addEventListener('visibilitychange', () => { if (!document.hidden) (bootstrapped ? pull() : bootstrap()).catch(() => {}); });
  document.addEventListener('krug:cloud-sync', () => (bootstrapped ? pull() : bootstrap()).catch(() => {}));
  setInterval(() => {
    if (!token()) return;
    (bootstrapped ? pull({renderAfter:true}) : bootstrap()).catch(() => {});
  }, 30000);
  // The admin token may be entered after initial page load. Retry bootstrap cheaply until it exists.
  setInterval(() => { if (!bootstrapped && token()) bootstrap().catch(() => {}); }, 3000);
  setTimeout(bootstrap, 500);

  window.KrugCloudState = { pull, push, bootstrap, enabled: () => Boolean(token()), version: () => cloudVersion };
})();
