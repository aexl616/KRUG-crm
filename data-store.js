/* Synchronous storage boundary. No business rules, DOM, auth or notifications. */
(function(root) {
  const STORAGE_KEY = 'studio-income-app-v1';
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  function clone(value) {
    const json = JSON.stringify(value, function(key, item) {
      if (typeof item === 'number' && !Number.isFinite(item)) throw new TypeError('Non-finite number');
      if (['bigint','function','symbol'].includes(typeof item)) throw new TypeError('Unsupported value');
      if (item === undefined && Array.isArray(this)) throw new TypeError('Undefined array item');
      if (record(item) && Object.prototype.toString.call(item) !== '[object Object]') throw new TypeError('Unsupported object');
      return item;
    });
    if (json === undefined) throw new TypeError('Missing data');
    return JSON.parse(json);
  }
  class LocalStorageAdapter {
    constructor(getStorage = () => root.localStorage, key = STORAGE_KEY) {
      this.getStorage = getStorage;
      this.key = key;
    }
    read() { return this.getStorage().getItem(this.key); }
    write(serialized) { this.getStorage().setItem(this.key, serialized); }
  }
  class DataStore {
    constructor({adapter, defaults = () => ({}), normalize = value => value, onError = () => {}}) {
      this.adapter = adapter;
      this.defaults = defaults;
      this.normalizers = [normalize];
      this.onError = onError;
      this.snapshot = {};
      this.writeBlocked = false;
      this.migrationBlocked = false;
      this.lastError = null;
    }
    fail(operation, error) {
      this.lastError = {operation, name:error?.name || 'Error'};
      // Do not log state, credentials or the JSON payload.
      console.error(`[KRUG data] ${operation} failed (${this.lastError.name})`);
      try { this.onError(this.lastError); } catch { /* UI errors cannot clear storage. */ }
      return false;
    }
    addNormalizer(normalize) { this.normalizers.push(normalize); }
    normalize(value) {
      if (!record(value)) throw new TypeError('State must be an object');
      return this.normalizers.reduce((data, normalize) => normalize(data), clone(value));
    }
    // Raw persisted snapshot, for metadata merges and stale-reminder checks.
    // null means failure; {} means the key is absent. Never write fallback here.
    readState() {
      try {
        const raw = this.adapter.read();
        const value = raw === null ? {} : JSON.parse(raw);
        if (!record(value)) throw new TypeError('Invalid stored state');
        this.snapshot = clone(value);
        if(!this.migrationBlocked) {
          this.writeBlocked = false;
          this.lastError = null;
        }
        return clone(value);
      } catch (error) {
        this.writeBlocked = true;
        this.fail('read', error);
        return null;
      }
    }
    loadState() {
      const saved = this.readState();
      try {
        const normalized=this.normalize({...clone(this.defaults()), ...(saved || {})});
        if(saved!==null){this.writeBlocked=false;this.migrationBlocked=false;this.lastError=null;}
        return normalized;
      } catch (error) {
        this.writeBlocked = true;
        this.fail('migration', error);
        this.migrationBlocked = true;
        return this.normalize(this.defaults());
      }
    }
    saveState(value) {
      try {
        if (this.writeBlocked) throw new Error('Storage requires recovery before writing');
        if (!record(value)) throw new TypeError('State must be an object');
        // Undefined object properties are omitted; preserve earlier root fields.
        const next = {...this.snapshot, ...clone(value)};
        const serialized = JSON.stringify(next);
        this.adapter.write(serialized);
        this.snapshot = clone(next);
        this.lastError = null;
        return true;
      } catch (error) { return this.fail('write', error); }
    }
    getCollection(name) {
      const data = this.loadState();
      return clone(data[name] === undefined ? [] : data[name]);
    }
    setCollection(name, value) {
      return this.change(data => {
        if (['__proto__','prototype','constructor'].includes(name) || !name) throw new TypeError('Invalid collection');
        data[name] = clone(value);
        return data;
      });
    }
    change(update) {
      try {
        const data = this.loadState();
        if (this.writeBlocked) return false;
        return this.saveState(update(data));
      } catch (error) { return this.fail('update', error); }
    }
    createEntity(collection, entity) {
      return this.change(data => {
        const rows = data[collection] === undefined ? [] : data[collection];
        if (!Array.isArray(rows) || !record(entity) || !entity.id || rows.some(e => e.id === entity.id)) throw new TypeError('Invalid or duplicate entity');
        data[collection] = [...rows, clone(entity)];
        return data;
      });
    }
    updateEntity(collection, id, patch) {
      return this.change(data => {
        const rows = data[collection];
        if (!Array.isArray(rows) || !rows.some(e => e.id === id) || !record(patch) || (patch.id !== undefined && patch.id !== id)) throw new TypeError('Invalid entity update');
        data[collection] = rows.map(e => e.id === id ? {...e, ...clone(patch), id} : e);
        return data;
      });
    }
    deleteEntity(collection, id) {
      return this.change(data => {
        const rows = data[collection];
        if (!Array.isArray(rows) || !rows.some(e => e.id === id)) throw new TypeError('Entity not found');
        data[collection] = rows.filter(e => e.id !== id);
        return data;
      });
    }
    // Opt-in reload helper: callers decide when discarding an open draft is safe.
    reloadState(current) {
      const fresh = this.loadState();
      return this.writeBlocked ? current : fresh;
    }
  }
  const api = {STORAGE_KEY, LocalStorageAdapter, DataStore};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KrugData = api;
})(globalThis);
