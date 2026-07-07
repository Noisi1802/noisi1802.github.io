// Persistance runtime (IndexedDB).
//   definitions : séances importées (parsées depuis le .md), clé = slug.
//   history     : une entrée JSON par séance jouée (résumé + timeline), clé = id.

const DB_NAME = 'ram';
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('definitions')) db.createObjectStore('definitions', { keyPath: 'slug' });
      if (!db.objectStoreNames.contains('history')) db.createObjectStore('history', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run(store, mode, fn) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}

export const putDefinition = (def) => run('definitions', 'readwrite', (os) => os.put(def));
export const getDefinitions = () => run('definitions', 'readonly', (os) => os.getAll());
export const getDefinition = (slug) => run('definitions', 'readonly', (os) => os.get(slug));
export const deleteDefinition = (slug) => run('definitions', 'readwrite', (os) => os.delete(slug));

export const putHistory = (entry) => run('history', 'readwrite', (os) => os.put(entry));
export const getHistory = () => run('history', 'readonly', (os) => os.getAll());
