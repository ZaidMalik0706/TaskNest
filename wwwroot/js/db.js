// Tiny IndexedDB helper: a queue of offline mutations and a cache of the last task list.
window.localDb = (function () {
  const DB_NAME = 'tasknest';
  const DB_VERSION = 1;
  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('queue')) {
          const queue = db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
          queue.createIndex('timestamp', 'timestamp');
        }
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache', { keyPath: 'key' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return dbPromise;
  }

  // Runs one store operation and resolves with the request result.
  function run(storeName, mode, action) {
    return openDB().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const request = action(tx.objectStore(storeName));
      tx.oncomplete = () => resolve(request ? request.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    }));
  }

  return {
    async getQueue() {
      const items = await run('queue', 'readonly', store => store.getAll());
      return items.sort((a, b) => a.id - b.id);
    },

    addToQueue(entry) {
      return run('queue', 'readwrite', store => store.add(entry));
    },

    removeFromQueue(id) {
      return run('queue', 'readwrite', store => store.delete(id));
    },

    countQueue() {
      return run('queue', 'readonly', store => store.count());
    },

    setCache(key, value) {
      return run('cache', 'readwrite', store => store.put({ key, value }));
    },

    async getCache(key) {
      const entry = await run('cache', 'readonly', store => store.get(key));
      return entry ? entry.value : null;
    }
  };
})();
