/**
 * 訪問追跡サービス — ドメイン × 対象ごとに最終訪問時刻を記録する。
 *
 * 「前回訪問からの変化サマリー」の計算起点として使う。
 * IndexedDB ベースの storageBackend に永続化し、localStorage にもフォールバック。
 */

import { getItem, setItem } from './storageBackend.js'

const STORAGE_KEY = 'market-intel-last-visits'

function loadAll() {
  try {
    const raw = getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveAll(map) {
  try {
    setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {}
}

function makeKey(domainId, appName) {
  return `${domainId || 'unknown'}::${appName || ''}`
}

/**
 * 前回訪問時刻を取得 (ISO 文字列 or null)。
 * 訪問記録がない場合は null (= 初回訪問)。
 */
export function getLastVisitAt(domainId, appName) {
  const all = loadAll()
  const entry = all[makeKey(domainId, appName)]
  return entry?.at || null
}

/**
 * 現在時刻を「前回訪問」として記録する。
 * 既に同じ対象に記録があれば上書き。
 */
export function markVisited(domainId, appName) {
  if (!appName) return null
  const all = loadAll()
  const now = new Date().toISOString()
  all[makeKey(domainId, appName)] = { at: now }
  saveAll(all)
  return now
}

/**
 * 記録済みの前回訪問情報を、読み取り用に全件返す (デバッグ/設定用)。
 */
export function getAllVisits() {
  return loadAll()
}

/**
 * 指定対象の訪問記録をリセット (初回訪問扱いに戻す)。
 */
export function resetVisit(domainId, appName) {
  const all = loadAll()
  delete all[makeKey(domainId, appName)]
  saveAll(all)
}
