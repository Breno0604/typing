/**
 * Wrapper mínimo de IndexedDB (sem dependências externas).
 * Banco único com três stores: settings (keyval), texts e results.
 */

const DB_NAME = 'typing-app'
const DB_VERSION = 1

export const STORE_SETTINGS = 'settings'
export const STORE_TEXTS = 'texts'
export const STORE_RESULTS = 'results'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS)
      }
      if (!db.objectStoreNames.contains(STORE_TEXTS)) {
        const store = db.createObjectStore(STORE_TEXTS, { keyPath: 'id' })
        store.createIndex('source', 'source')
        store.createIndex('level', 'level')
      }
      if (!db.objectStoreNames.contains(STORE_RESULTS)) {
        const store = db.createObjectStore(STORE_RESULTS, { keyPath: 'id' })
        store.createIndex('finishedAt', 'finishedAt')
        store.createIndex('mode', 'mode')
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => {
      dbPromise = null
      reject(request.error ?? new Error('Falha ao abrir o banco local'))
    }
  })
  return dbPromise
}

function requestAsPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Erro no banco local'))
  })
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await openDb()
  return new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(storeName, mode)
    const store = tx.objectStore(storeName)
    let result: T | undefined
    const req = fn(store)
    if (req) {
      requestAsPromise(req).then((v) => (result = v)).catch(reject)
    }
    tx.oncomplete = () => resolve(result)
    tx.onerror = () => reject(tx.error ?? new Error('Erro na transação'))
    tx.onabort = () => reject(tx.error ?? new Error('Transação abortada'))
  })
}

export async function dbGet<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
  return (await withStore(storeName, 'readonly', (s) => s.get(key))) as T | undefined
}

export async function dbPut(storeName: string, value: unknown, key?: IDBValidKey): Promise<void> {
  await withStore(storeName, 'readwrite', (s) =>
    key !== undefined ? s.put(value, key) : s.put(value),
  )
}

export async function dbDelete(storeName: string, key: IDBValidKey): Promise<void> {
  await withStore(storeName, 'readwrite', (s) => s.delete(key))
}

export async function dbGetAll<T>(storeName: string): Promise<T[]> {
  return (await withStore(storeName, 'readonly', (s) => s.getAll())) as T[]
}

export async function dbClear(storeName: string): Promise<void> {
  await withStore(storeName, 'readwrite', (s) => s.clear())
}
