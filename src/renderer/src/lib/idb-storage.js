/**
 * IndexedDB-backed storage for zustand's persist middleware. Chat histories
 * outgrow localStorage's ~10MB sync-write budget; IndexedDB is async and its
 * quota is disk-based, so conversations can grow freely.
 */

const DB_NAME = 'nativeblade-studio';
const STORE = 'kv';

let dbPromise = null;
function db() {
    dbPromise ??= new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    return dbPromise;
}

async function op(mode, fn) {
    const d = await db();
    return new Promise((resolve, reject) => {
        const tx = d.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req?.result);
        tx.onerror = () => reject(tx.error);
    });
}

export const idbStorage = {
    getItem: async (name) => (await op('readonly', (s) => s.get(name))) ?? null,
    setItem: (name, value) => op('readwrite', (s) => s.put(value, name)),
    removeItem: (name) => op('readwrite', (s) => s.delete(name)),
};
