// 생성 기록 영구 저장소 (IndexedDB)
// base64/Blob 이미지는 용량이 커서 localStorage 대신 IndexedDB 를 사용한다.

const DB_NAME = 'qimg'
const STORE = 'history'
const VERSION = 1
const MAX_ITEMS = 300

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: 'id' })
        os.createIndex('createdAt', 'createdAt')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// item: { id, blob, format, prompt, size, model, n, refCount, createdAt }
export async function addHistoryItem(item) {
  const db = await openDB()
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(item)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  await pruneHistory()
}

export async function getAllHistory() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve((req.result || []).sort((a, b) => b.createdAt - a.createdAt))
    req.onerror = () => reject(req.error)
  })
}

export async function deleteHistoryItem(id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function clearAllHistory() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// 오래된 기록을 MAX_ITEMS 개로 유지
async function pruneHistory() {
  const all = await getAllHistory()
  if (all.length <= MAX_ITEMS) return
  const db = await openDB()
  const toDelete = all.slice(MAX_ITEMS)
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    toDelete.forEach((it) => store.delete(it.id))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
