const DB_NAME = 'tss-flyer-app';
const DB_VERSION = 2;
const KV = 'kv';
const DRAFTS = 'drafts';
const BLOBS = 'blobs';
let dbPromise = null;
function openDb() {
    if (dbPromise)
        return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(KV))
                db.createObjectStore(KV);
            if (!db.objectStoreNames.contains(DRAFTS))
                db.createObjectStore(DRAFTS);
            if (!db.objectStoreNames.contains(BLOBS))
                db.createObjectStore(BLOBS);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('IndexedDBを開けませんでした。'));
    });
    return dbPromise;
}
async function transaction(storeName, mode, action) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const request = action(tx.objectStore(storeName));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('ローカル保存に失敗しました。'));
        tx.onerror = () => reject(tx.error ?? new Error('ローカル保存に失敗しました。'));
    });
}
export async function kvGet(key) {
    const result = await transaction(KV, 'readonly', (store) => store.get(key));
    return result ?? null;
}
export async function kvSet(key, value) {
    await transaction(KV, 'readwrite', (store) => store.put(value, key));
}
export async function kvDelete(key) {
    await transaction(KV, 'readwrite', (store) => store.delete(key));
}
export async function draftGet(key) {
    const result = await transaction(DRAFTS, 'readonly', (store) => store.get(key));
    return result ?? null;
}
export async function draftSet(key, value) {
    await transaction(DRAFTS, 'readwrite', (store) => store.put(value, key));
}
export async function draftDelete(key) {
    await transaction(DRAFTS, 'readwrite', (store) => store.delete(key));
}
export async function blobSet(key, blob) {
    await transaction(BLOBS, 'readwrite', (store) => store.put(blob, key));
}
export async function blobGet(key) {
    const result = await transaction(BLOBS, 'readonly', (store) => store.get(key));
    return result ?? null;
}
export async function blobDelete(key) {
    await transaction(BLOBS, 'readwrite', (store) => store.delete(key));
}
//# sourceMappingURL=localDb.js.map