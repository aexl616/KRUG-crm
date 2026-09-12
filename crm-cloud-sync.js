(() => {
  'use strict';

  const TOKEN_KEY = 'krug-crm-session-v1';
  const API_URL = '/api/crm-state';
  const COLLECTIONS = ['clients','bookings','payments','expenses','payouts','studioBlocks'];
  const VERSION_KEY = 'krug-crm-cloud-version-v1';
  let cloudVersion = Number(sessionStorage.getItem(VERSION_KEY) || 0);
  let syncing = false;
  let bootstrapped = false;
  let pushTimer = null;
  let readCollections = [];
  let writeCollections = [];
  const baseSaveState = typeof saveState === 'function' ? saveState : null;

  const clone = value => JSON.parse(JSON.stringify(value));
  const token = () => sessionStorage.getItem(TOKEN_KEY) || '';
  const actor = () => {
    try { return typeof currentUser === 'function' ? (currentUser()?.name || 'crm') : 'crm'; }
    catch { return 'crm'; }
  };

  function normalizeCollections(value) {
    return Array.isArray(value) ? value.filter(key => COLLECTIONS.includes(key)) : [];
  }

  function absorbRemote(remote) {
    const permissions = remote?.permissions || {};
    readCollections = normalizeCollections(permissions.read);
    writeCollections = normalizeCollections(permissions.write);
    rememberVersion(remote?.version);
    return remote;
  }

  function snapshot() {
    const result = {};
    writeCollections.forEach(key => { result[key] = clone(Array.isArray(state?.[key]) ? state[key] : []); });
    return result;
  }

  function applySnapshot(remote) {
    if (!remote || typeof remote !== 'object') return false;
    let changed = false;
    readCollections.forEach(key => {
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
      if (response.status === 401) setTimeout(() => window.KrugCrmAuth?.logout?.(), 0);
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
      const remote = absorbRemote(await request('get'));
      if (!remote || Number(remote.version) === 0) return false;
      const changed = applySnapshot(remote.data);
      if (changed && baseSaveState) baseSaveState();
      if (changed && renderAfter && typeof render === 'function') render();
      document.dispatchEvent(new CustomEvent('krug:cloud-state', {detail:{direction:'pull',version:cloudVersion,changed,read:[...readCollections],write:[...writeCollections]}}));
      return changed;
    } finally { syncing = false; }
  }

  async function push() {
    if (!token() || syncing || typeof state === 'undefined' || !writeCollections.length) return false;
    syncing = true;
    try {
      try {
        const remote = absorbRemote(await request('put', {expectedVersion:cloudVersion,state:snapshot(),updatedBy:actor()}));
        const changed = applySnapshot(remote?.data);
        if (changed && baseSaveState) baseSaveState();
        document.dispatchEvent(new CustomEvent('krug:cloud-state', {detail:{direction:'push',version:cloudVersion,changed:true,read:[...readCollections],write:[...writeCollections]}}));
        return true;
      } catch (error) {
        if (!['CRM_STATE_CONFLICT','SLOT_UNAVAILABLE'].includes(error.code)) throw error;
        const latest = absorbRemote(await request('get'));
        // Server wins on conflicts. Only collections readable by this role are applied.
        const changed = applySnapshot(latest.data);
        if (changed && baseSaveState) baseSaveState();
        if (changed && typeof render === 'function') render();
        if (error.code === 'SLOT_UNAVAILABLE') alert(error.message);
        document.dispatchEvent(new CustomEvent('krug:cloud-state', {detail:{direction:'conflict',version:cloudVersion,changed,read:[...readCollections],write:[...writeCollections]}}));
        return false;
      }
    } finally { syncing = false; }
  }

  function schedulePush() {
    if (!token() || !bootstrapped || !writeCollections.length) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => push().catch(error => console.warn('[KRUG CRM] cloud push failed', error?.code || error?.message || error)), 550);
  }

  async function bootstrap() {
    if (bootstrapped || !token() || typeof state === 'undefined') return;
    bootstrapped = true;
    try {
      const remote = absorbRemote(await request('get'));
      if (Number(remote.version) > 0) {
        const changed = applySnapshot(remote.data);
        if (changed && baseSaveState) baseSaveState();
        if (changed && typeof render === 'function') render();
      } else if (writeCollections.includes('payments')) {
        // Only owner/admin can initialize the complete shared state.
        await push();
      }
      document.dispatchEvent(new CustomEvent('krug:cloud-state', {detail:{direction:'bootstrap',version:cloudVersion,changed:false,read:[...readCollections],write:[...writeCollections]}}));
    } catch (error) {
      bootstrapped = false;
      console.warn('[KRUG CRM] cloud bootstrap failed', error?.code || error?.message || error);
    }
  }

  function reset() {
    clearTimeout(pushTimer);
    syncing = false;
    bootstrapped = false;
    readCollections = [];
    writeCollections = [];
    cloudVersion = 0;
    sessionStorage.removeItem(VERSION_KEY);
    if (token()) setTimeout(() => bootstrap().catch(() => {}), 0);
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
  document.addEventListener('krug:crm-auth', reset);
  setInterval(() => {
    if (!token()) return;
    (bootstrapped ? pull({renderAfter:true}) : bootstrap()).catch(() => {});
  }, 30000);
  setInterval(() => { if (!bootstrapped && token()) bootstrap().catch(() => {}); }, 3000);
  setTimeout(bootstrap, 500);

  window.KrugCloudState = {
    pull, push, bootstrap, reset,
    enabled: () => Boolean(token()),
    version: () => cloudVersion,
    permissions: () => ({read:[...readCollections],write:[...writeCollections]})
  };
})();
