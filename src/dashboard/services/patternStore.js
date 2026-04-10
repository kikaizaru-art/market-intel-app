/**
 * パターン学習ストア (localStorage ベース)
 *
 * 自動検証の結果（承認/却下）を蓄積し、
 * パターンタイプごとの信頼度重みを動的に調整する。
 * 手動操作不要 — データ駆動で学習が回る。
 *
 * 保存データ構造:
 *   patternWeights: { [patternType]: number }   — 累積重み調整値
 *   feedbackLog:    { id, patternType, action, source, timestamp }[]
 *   stats:          { confirmed, rejected, total }
 */

const STORAGE_KEY = 'market-intel-pattern-store'

const WEIGHT_CONFIRM = 0.03
const WEIGHT_REJECT  = -0.05
const MAX_WEIGHT     = 0.35
const MIN_WEIGHT     = -0.40

function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createDefaultStore()
    return JSON.parse(raw)
  } catch {
    return createDefaultStore()
  }
}

function saveStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {}
}

function createDefaultStore() {
  return {
    patternWeights: {},
    feedbackLog: [],
    stats: { confirmed: 0, rejected: 0, total: 0 },
    signalWeights: {},
    processedIds: [],  // 重複処理防止
  }
}

export function getPatternWeights() {
  return loadStore().patternWeights
}

export function getLearningStats() {
  const store = loadStore()
  const { stats, patternWeights, feedbackLog } = store

  const byPattern = {}
  for (const log of feedbackLog) {
    if (!byPattern[log.patternType]) {
      byPattern[log.patternType] = { confirmed: 0, rejected: 0 }
    }
    byPattern[log.patternType][log.action]++
  }

  const accuracy = stats.total > 0
    ? Math.round((stats.confirmed / stats.total) * 100)
    : 0

  return {
    ...stats,
    accuracy,
    patternWeights,
    byPattern,
    totalFeedback: feedbackLog.length,
  }
}

/**
 * フィードバックを記録し学習を実行
 * @param {'confirmed'|'rejected'} action
 * @param {object} memo
 * @param {'auto'|'manual'} source — 自動検証 or 手動オーバーライド
 */
export function recordFeedback(action, memo, source = 'auto') {
  const store = loadStore()

  // 同一IDの重複処理を防止
  if (store.processedIds.includes(memo.id)) return store
  store.processedIds.push(memo.id)
  if (store.processedIds.length > 500) {
    store.processedIds = store.processedIds.slice(-500)
  }

  store.feedbackLog.push({
    id: memo.id,
    patternType: memo.patternType,
    action,
    source,
    signals: memo.signals || [],
    confidence: memo.confidence,
    validationResult: memo.validationResult || null,
    timestamp: Date.now(),
  })

  if (store.feedbackLog.length > 300) {
    store.feedbackLog = store.feedbackLog.slice(-300)
  }

  // パターンタイプ重みの更新
  const delta = action === 'confirmed' ? WEIGHT_CONFIRM : WEIGHT_REJECT
  const pt = memo.patternType
  const current = store.patternWeights[pt] || 0
  store.patternWeights[pt] = Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, current + delta))

  // シグナル重みの更新
  for (const signal of (memo.signals || [])) {
    const sigKey = `${pt}:${signal}`
    const sigCurrent = store.signalWeights[sigKey] || 0
    const sigDelta = action === 'confirmed' ? 0.02 : -0.03
    store.signalWeights[sigKey] = Math.max(-0.3, Math.min(0.3, sigCurrent + sigDelta))
  }

  store.stats[action] = (store.stats[action] || 0) + 1
  store.stats.total = (store.stats.total || 0) + 1

  saveStore(store)
  return store
}

/**
 * 自動検証済みメモを一括で学習に記録
 */
export function recordBatchFeedback(confirmed, rejected) {
  for (const memo of confirmed) {
    recordFeedback('confirmed', memo, 'auto')
  }
  for (const memo of rejected) {
    recordFeedback('rejected', memo, 'auto')
  }
}

export function resetLearning() {
  saveStore(createDefaultStore())
}

export function getSignalWeights() {
  return loadStore().signalWeights
}
