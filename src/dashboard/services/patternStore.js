/**
 * パターン学習ストア (localStorage ベース)
 *
 * ユーザーの承認/却下フィードバックを蓄積し、
 * パターンタイプごとの信頼度重みを動的に調整する。
 *
 * 保存データ構造:
 *   patternWeights: { [patternType]: number }   — 累積重み調整値
 *   feedbackLog:    { id, patternType, action, signals, timestamp }[]
 *   stats:          { confirmed, rejected, total }
 */

const STORAGE_KEY = 'market-intel-pattern-store'

const WEIGHT_CONFIRM = 0.03   // 承認時の重み増加量
const WEIGHT_REJECT  = -0.05  // 却下時の重み減少量（より強くペナルティ）
const MAX_WEIGHT     = 0.35   // 累積重みの上限
const MIN_WEIGHT     = -0.40  // 累積重みの下限

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
  } catch {
    // localStorage が使えない環境では無視
  }
}

function createDefaultStore() {
  return {
    patternWeights: {},
    feedbackLog: [],
    stats: { confirmed: 0, rejected: 0, total: 0 },
    signalWeights: {},
  }
}

/**
 * 現在の学習済みパターン重みを取得
 */
export function getPatternWeights() {
  return loadStore().patternWeights
}

/**
 * 学習統計を取得
 */
export function getLearningStats() {
  const store = loadStore()
  const { stats, patternWeights, feedbackLog } = store

  // パターンタイプ別の統計
  const byPattern = {}
  for (const log of feedbackLog) {
    if (!byPattern[log.patternType]) {
      byPattern[log.patternType] = { confirmed: 0, rejected: 0 }
    }
    byPattern[log.patternType][log.action]++
  }

  // 精度 = confirmed / (confirmed + rejected)
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
 * @param {object} memo - 対象の自動メモ
 */
export function recordFeedback(action, memo) {
  const store = loadStore()

  // フィードバックログに追記
  store.feedbackLog.push({
    id: memo.id,
    patternType: memo.patternType,
    action,
    signals: memo.signals || [],
    confidence: memo.confidence,
    timestamp: Date.now(),
  })

  // 直近300件に制限（メモリ節約）
  if (store.feedbackLog.length > 300) {
    store.feedbackLog = store.feedbackLog.slice(-300)
  }

  // パターンタイプ重みの更新
  const delta = action === 'confirmed' ? WEIGHT_CONFIRM : WEIGHT_REJECT
  const pt = memo.patternType
  const current = store.patternWeights[pt] || 0
  store.patternWeights[pt] = Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, current + delta))

  // シグナル重みの更新（より細粒度の学習）
  for (const signal of (memo.signals || [])) {
    const sigKey = `${pt}:${signal}`
    const sigCurrent = store.signalWeights[sigKey] || 0
    const sigDelta = action === 'confirmed' ? 0.02 : -0.03
    store.signalWeights[sigKey] = Math.max(-0.3, Math.min(0.3, sigCurrent + sigDelta))
  }

  // 統計更新
  store.stats[action] = (store.stats[action] || 0) + 1
  store.stats.total = (store.stats.total || 0) + 1

  saveStore(store)
  return store
}

/**
 * 学習データをリセット
 */
export function resetLearning() {
  saveStore(createDefaultStore())
}

/**
 * シグナルの学習済み重みを取得（autoMemoで使用可能）
 */
export function getSignalWeights() {
  return loadStore().signalWeights
}
