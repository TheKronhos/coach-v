// Tiny IndexedDB wrapper. Two stores:
//   kv   - program overlay ("program:current", "program:previous"), settings
//   log  - training log entries (autoIncrement id)
const DB_NAME = 'coach-v';
const DB_VERSION = 1;
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('log')) db.createObjectStore('log', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function tx(store, mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    const out = fn(s);
    t.oncomplete = () => resolve(out && 'result' in out ? out.result : out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

export const kvGet = (key) => tx('kv', 'readonly', (s) => s.get(key));
export const kvSet = (key, value) => tx('kv', 'readwrite', (s) => s.put(value, key));
export const kvDel = (key) => tx('kv', 'readwrite', (s) => s.delete(key));

// Set several keys atomically (used for program import / undo).
export const kvSetMany = (entries) => tx('kv', 'readwrite', (s) => {
  for (const [k, v] of entries) v === undefined ? s.delete(k) : s.put(v, k);
});

export const logAll = () => tx('log', 'readonly', (s) => s.getAll());
export const logPut = (entry) => tx('log', 'readwrite', (s) => s.put(entry));
export const logDelete = (id) => tx('log', 'readwrite', (s) => s.delete(id));
