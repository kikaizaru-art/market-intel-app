/**
 * IndexedDB ストレージバックエンド (インメモリキャッシュ付き)
 *
 * localStorage の代替として動作する。
 * - 読み取り: メモリキャッシュから同期的に返す
 * - 書き込み: キャッシュを即座に更新 + IndexedDB に非同期で永続化
 * - 起動時: IndexedDB からキャッシュにロード。IndexedDB が空なら localStorage から移行
 *
 * これにより既存の同期 API をそのまま維持しつつ、
 * ブラウザキャッシュクリアに耐える堅牢な永続化を実現する。
 */

const DB_NAME = 'market-intel-db'
const DB_VERSION = 1
const STORE_NAME = 'kvStore'

// localStorage のキー一覧 (移行対象)
const LEGACY_KEYS = [
  'market-intel-pattern-store',
  'market-intel-learning-settings',
  'market-intel-causal-notes',
  'market-intel-rejected-auto',
]

// ─── インメモリキャッシュ ────────────────────────────────────
const cache = new Map()
let ready = false
let initPromise = null

// ─── IndexedDB ヘルパー ──────────────────────────────────────

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function idbGet(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.get(key)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function idbPut(db, key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.put(value, key)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

function idbGetAll(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const entries = {}
    const request = store.openCursor()
    request.onsuccess = (event) => {
      const cursor = event.target.result
      if (cursor) {
        entries[cursor.key] = cursor.value
        cursor.continue()
      } else {
        resolve(entries)
      }
    }
    request.onerror = () => reject(request.error)
  })
}

// ─── DB インスタンス保持 ─────────────────────────────────────
let dbInstance = null

async function getDB() {
  if (!dbInstance) {
    dbInstance = await openDB()
  }
  return dbInstance
}

// ─── 公開 API ────────────────────────────────────────────────

/**
 * ストレージを初期化する。
 * IndexedDB からデータをロードし、なければ localStorage から移行する。
 * アプリ起動時に1回だけ呼ぶ。
 */
export async function initStorage() {
  if (ready) return
  if (initPromise) return initPromise

  initPromise = (async () => {
    try {
      const db = await getDB()
      const entries = await idbGetAll(db)
      const hasData = Object.keys(entries).length > 0

      if (hasData) {
        // IndexedDB にデータあり → キャッシュにロード
        for (const [key, value] of Object.entries(entries)) {
          cache.set(key, value)
        }
      } else {
        // IndexedDB 空 → localStorage から移行
        await migrateFromLocalStorage(db)
      }
    } catch (e) {
      // IndexedDB が使えない場合 (プライベートブラウジング等) → localStorage フォールバック
      console.warn('IndexedDB unavailable, falling back to localStorage:', e.message)
      for (const key of LEGACY_KEYS) {
        try {
          const raw = localStorage.getItem(key)
          if (raw !== null) {
            cache.set(key, raw)
          }
        } catch {}
      }
    }
    ready = true
  })()

  return initPromise
}

/**
 * localStorage → IndexedDB への移行
 */
async function migrateFromLocalStorage(db) {
  let migrated = 0
  for (const key of LEGACY_KEYS) {
    try {
      const raw = localStorage.getItem(key)
      if (raw !== null) {
        cache.set(key, raw)
        await idbPut(db, key, raw)
        migrated++
      }
    } catch {}
  }

  if (migrated > 0) {
    console.log(`[storage] localStorage → IndexedDB 移行完了: ${migrated}件`)
    // 移行成功後に localStorage をクリーンアップ
    for (const key of LEGACY_KEYS) {
      try {
        localStorage.removeItem(key)
      } catch {}
    }
  }
}

/**
 * 同期読み取り (キャッシュから)
 * @param {string} key
 * @returns {string|null}
 */
export function getItem(key) {
  if (!ready) {
    // 初期化前のフォールバック (通常は発生しない)
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  }
  const value = cache.get(key)
  return value !== undefined ? value : null
}

/**
 * 同期書き込み (キャッシュ更新 + IndexedDB 非同期永続化)
 * @param {string} key
 * @param {string} value
 */
export function setItem(key, value) {
  cache.set(key, value)

  if (!ready) {
    // 初期化前のフォールバック
    try {
      localStorage.setItem(key, value)
    } catch {}
    return
  }

  // IndexedDB に非同期で永続化 (fire-and-forget)
  persistToIDB(key, value)
}

/**
 * IndexedDB への非同期書き込み (エラーはログのみ)
 */
async function persistToIDB(key, value) {
  try {
    const db = await getDB()
    await idbPut(db, key, value)
  } catch (e) {
    console.warn(`[storage] IndexedDB write failed for "${key}":`, e.message)
    // フォールバック: localStorage にも書く
    try {
      localStorage.setItem(key, value)
    } catch {}
  }
}

/**
 * ストレージ初期化済みかどうか
 */
export function isReady() {
  return ready
}
