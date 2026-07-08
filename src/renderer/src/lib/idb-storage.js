/**
 * IndexedDB-backed storage for zustand's persist middleware. Chat histories
 * outgrow localStorage's ~10MB sync-write budget; IndexedDB is async and its
 * quota is disk-based, so conversations can grow freely.
 *
 * Writes are coalesced: zustand persists on every `set()`, and a live AI run
 * fires one `set` per streamed token/tool, so without throttling each token
 * would re-serialize and rewrite the whole history (quadratic over a long
 * session). We keep only the latest value per key and flush at most once per
 * FLUSH_MS, plus a best-effort flush when the window is going away.
 */

const DB_NAME = 'nativeblade-studio';
const STORE = 'kv';
const FLUSH_MS = 800;

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

// name -> latest value not yet written. Only the most recent value matters, so
// a burst of writes to the same key collapses into a single put on flush.
const pending = new Map();
let timer = null;

function flush() {
    timer = null;
    for (const [name, value] of pending) op('readwrite', (s) => s.put(value, name)).catch(() => {});
    pending.clear();
}

export const idbStorage = {
    getItem: async (name) => (await op('readonly', (s) => s.get(name))) ?? null,
    setItem: (name, value) => {
        pending.set(name, value);
        timer ??= setTimeout(flush, FLUSH_MS);
        return Promise.resolve();
    },
    removeItem: (name) => {
        pending.delete(name);
        return op('readwrite', (s) => s.delete(name));
    },
};

// Best-effort flush of the last pending write before the window goes away.
// IndexedDB on unload isn't guaranteed, but completed turns are already on disk
// (they predate the final debounce window), so at worst the tail of a run that
// was quit mid-stream is lost — the same live state that never survives restart.
if (typeof window !== 'undefined') {
    const drain = () => { if (pending.size) { if (timer) clearTimeout(timer); flush(); } };
    window.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') drain(); });
    window.addEventListener('beforeunload', drain);
}
