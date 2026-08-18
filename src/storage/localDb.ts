const DB_NAME = 'tss-flyer-app';
const DB_VERSION = 2;
const KV = 'kv';
const DRAFTS = 'drafts';
const BLOBS = 'blobs';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(KV)) db.createObjectStore(KV);
      if (!db.objectStoreNames.contains(DRAFTS)) db.createObjectStore(DRAFTS);
      if (!db.objectStoreNames.contains(BLOBS)) db.createObjectStore(BLOBS);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDBを開けませんでした。'));
  });
  return dbPromise;
}

async function transaction<T>(storeName: string, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const request = action(tx.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('ローカル保存に失敗しました。'));
    tx.onerror = () => reject(tx.error ?? new Error('ローカル保存に失敗しました。'));
  });
}

export async function kvGet<T>(key: string): Promise<T | null> {
  const result = await transaction<T | undefined>(KV, 'readonly', (store) => store.get(key));
  return result ?? null;
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  await transaction<IDBValidKey>(KV, 'readwrite', (store) => store.put(value, key));
}

export async function kvDelete(key: string): Promise<void> {
  await transaction<undefined>(KV, 'readwrite', (store) => store.delete(key));
}

export async function draftGet<T>(key: string): Promise<T | null> {
  const result = await transaction<T | undefined>(DRAFTS, 'readonly', (store) => store.get(key));
  return result ?? null;
}

export async function draftSet<T>(key: string, value: T): Promise<void> {
  await transaction<IDBValidKey>(DRAFTS, 'readwrite', (store) => store.put(value, key));
}

export async function draftDelete(key: string): Promise<void> {
  await transaction<undefined>(DRAFTS, 'readwrite', (store) => store.delete(key));
}

export async function blobSet(key: string, blob: Blob): Promise<void> {
  await transaction<IDBValidKey>(BLOBS, 'readwrite', (store) => store.put(blob, key));
}

export async function blobGet(key: string): Promise<Blob | null> {
  const result = await transaction<Blob | undefined>(BLOBS, 'readonly', (store) => store.get(key));
  return result ?? null;
}

export async function blobDelete(key: string): Promise<void> {
  await transaction<undefined>(BLOBS, 'readwrite', (store) => store.delete(key));
}
