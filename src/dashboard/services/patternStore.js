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
 *
 * ユーザー設定:
 *   enabledPatterns: { [patternType]: boolean }  — パターン有効/無効
 *   thresholds:      { trendShiftPct, reviewSpikeDelta, autoConfirm, autoReject }
 *   learningRate:    { confirm, reject }
 *   preset:          'balanced' | 'cautious' | 'aggressive'
 *
 * 学習制御:
 *   lockedAtIndex: number | null  — この位置で学習を固定 (null = 通常進行)
 *   feedbackLog から任意の時点まで重みを再計算してロールバック可能
 */

const STORAGE_KEY = 'market-intel-pattern-store'
const SETTINGS_KEY = 'market-intel-learning-settings'
const CAUSAL_NOTES_KEY = 'market-intel-causal-notes'
const REJECTED_AUTO_KEY = 'market-intel-rejected-auto'

const WEIGHT_CONFIRM = 0.03
const WEIGHT_REJECT  = -0.05
const MAX_WEIGHT     = 0.35
const MIN_WEIGHT     = -0.40

// ─── プリセット定義 ────────────────────────────────────────
export const PRESETS = {
  cautious: {
    label: '慎重',
    description: '高信頼のみ承認。見逃しより誤検出を減らす',
    thresholds: { trendShiftPct: 15, reviewSpikeDelta: 0.5, autoConfirm: 0.80, autoReject: 0.40 },
    learningRate: { confirm: 0.02, reject: -0.06 },
  },
  balanced: {
    label: 'バランス',
    description: 'デフォルト設定。検出と精度のバランスを取る',
    thresholds: { trendShiftPct: 10, reviewSpikeDelta: 0.3, autoConfirm: 0.65, autoReject: 0.30 },
    learningRate: { confirm: 0.03, reject: -0.05 },
  },
  aggressive: {
    label: '積極',
    description: '広く検出。多少ノイズが入っても見逃さない',
    thresholds: { trendShiftPct: 5, reviewSpikeDelta: 0.15, autoConfirm: 0.50, autoReject: 0.20 },
    learningRate: { confirm: 0.05, reject: -0.03 },
  },
}

const DEFAULT_SETTINGS = {
  enabledPatterns: {
    anomaly_event: true,
    trend_shift: true,
    review_spike: true,
    news_correlation: true,
    seasonal: true,
  },
  thresholds: { ...PRESETS.balanced.thresholds },
  learningRate: { ...PRESETS.balanced.learningRate },
  preset: 'balanced',
  lockedAtIndex: null,
}

// ─── 設定の読み書き ────────────────────────────────────────

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {}
}

export function getUserSettings() {
  return loadSettings()
}

export function updateUserSettings(partial) {
  const current = loadSettings()
  const updated = { ...current, ...partial }
  // プリセットとの一致チェック → 一致しなければ 'custom'
  if (partial.thresholds || partial.learningRate) {
    updated.preset = detectPreset(updated)
  }
  saveSettings(updated)
  return updated
}

export function applyPreset(presetName) {
  const preset = PRESETS[presetName]
  if (!preset) return loadSettings()
  const current = loadSettings()
  const updated = {
    ...current,
    thresholds: { ...preset.thresholds },
    learningRate: { ...preset.learningRate },
    preset: presetName,
  }
  saveSettings(updated)
  return updated
}

function detectPreset(settings) {
  for (const [name, preset] of Object.entries(PRESETS)) {
    const t = preset.thresholds
    const s = settings.thresholds
    const lr = preset.learningRate
    const slr = settings.learningRate
    if (
      t.trendShiftPct === s.trendShiftPct &&
      t.reviewSpikeDelta === s.reviewSpikeDelta &&
      t.autoConfirm === s.autoConfirm &&
      t.autoReject === s.autoReject &&
      lr.confirm === slr.confirm &&
      lr.reject === slr.reject
    ) return name
  }
  return 'custom'
}

// ─── 学習タイムライン・ロールバック・ロック ────────────────

/**
 * feedbackLog を先頭から count 件まで再生して重みを再計算する。
 * ログ自体が「学習履歴」なので、任意の時点に巻き戻せる。
 */
function replayWeights(feedbackLog, count) {
  const settings = loadSettings()
  const confirmDelta = settings.learningRate?.confirm ?? WEIGHT_CONFIRM
  const rejectDelta  = settings.learningRate?.reject  ?? WEIGHT_REJECT

  const patternWeights = {}
  const signalWeights  = {}
  const stats = { confirmed: 0, rejected: 0, total: 0 }

  const entries = feedbackLog.slice(0, count)
  for (const entry of entries) {
    const delta = entry.action === 'confirmed' ? confirmDelta : rejectDelta
    const pt = entry.patternType
    patternWeights[pt] = Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, (patternWeights[pt] || 0) + delta))

    const sigDelta = entry.action === 'confirmed' ? confirmDelta * 0.67 : rejectDelta * 0.6
    for (const signal of (entry.signals || [])) {
      const sigKey = `${pt}:${signal}`
      signalWeights[sigKey] = Math.max(-0.3, Math.min(0.3, (signalWeights[sigKey] || 0) + sigDelta))
    }

    stats[entry.action] = (stats[entry.action] || 0) + 1
    stats.total++
  }

  return { patternWeights, signalWeights, stats }
}

/**
 * 学習タイムラインを取得。
 * 各エントリに累積的中率を付与して返す。
 */
export function getLearningTimeline() {
  const store = loadStore()
  const log = store.feedbackLog
  if (!log.length) return []

  let confirmed = 0
  let total = 0
  return log.map((entry, index) => {
    total++
    if (entry.action === 'confirmed') confirmed++
    return {
      ...entry,
      index,
      cumulativeAccuracy: Math.round((confirmed / total) * 100),
      cumulativeTotal: total,
    }
  })
}

/**
 * 指定インデックスの時点まで学習をロールバックする。
 * それ以降のログは切り捨て、重みを再計算。
 * @param {number} toIndex — この位置（含む）までのログを残す (0-based)
 */
export function rollbackToIndex(toIndex) {
  const store = loadStore()
  const keepCount = toIndex + 1
  store.feedbackLog = store.feedbackLog.slice(0, keepCount)
  store.processedIds = store.feedbackLog.map(e => e.id)

  const { patternWeights, signalWeights, stats } = replayWeights(store.feedbackLog, keepCount)
  store.patternWeights = patternWeights
  store.signalWeights  = signalWeights
  store.stats          = stats

  saveStore(store)
  // ロック解除（巻き戻したらロックも外れる）
  const settings = loadSettings()
  if (settings.lockedAtIndex !== null && settings.lockedAtIndex !== undefined) {
    saveSettings({ ...settings, lockedAtIndex: null })
  }
  return store
}

/**
 * 現在の学習状態を固定（ロック）する。
 * ロック中は新しいフィードバックをログに記録するが、重みは更新しない。
 */
export function lockLearning() {
  const store = loadStore()
  const settings = loadSettings()
  settings.lockedAtIndex = store.feedbackLog.length - 1
  saveSettings(settings)
  return settings.lockedAtIndex
}

/**
 * ロックを解除し、ロック中に溜まったログも含めて重みを再計算する。
 */
export function unlockLearning() {
  const store = loadStore()
  const settings = loadSettings()
  settings.lockedAtIndex = null
  saveSettings(settings)

  // ロック中に追加されたログも含めて重みを再計算
  const { patternWeights, signalWeights, stats } = replayWeights(store.feedbackLog, store.feedbackLog.length)
  store.patternWeights = patternWeights
  store.signalWeights  = signalWeights
  store.stats          = stats
  saveStore(store)
}

export function isLearningLocked() {
  const settings = loadSettings()
  return settings.lockedAtIndex !== null && settings.lockedAtIndex !== undefined
}

export function getLockedAtIndex() {
  const settings = loadSettings()
  return settings.lockedAtIndex ?? null
}

// ─── 学習ストア ────────────────────────────────────────────

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
  // ロック中は学習を凍結（ログだけは記録）
  const locked = isLearningLocked()
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

  if (!locked) {
    // ユーザー設定の学習レートを使用
    const settings = loadSettings()
    const confirmDelta = settings.learningRate?.confirm ?? WEIGHT_CONFIRM
    const rejectDelta = settings.learningRate?.reject ?? WEIGHT_REJECT

    // パターンタイプ重みの更新
    const delta = action === 'confirmed' ? confirmDelta : rejectDelta
    const pt = memo.patternType
    const current = store.patternWeights[pt] || 0
    store.patternWeights[pt] = Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, current + delta))

    // シグナル重みの更新
    const sigConfirmDelta = confirmDelta * 0.67  // パターン重みに比例
    const sigRejectDelta = rejectDelta * 0.6
    for (const signal of (memo.signals || [])) {
      const sigKey = `${pt}:${signal}`
      const sigCurrent = store.signalWeights[sigKey] || 0
      const sigDelta = action === 'confirmed' ? sigConfirmDelta : sigRejectDelta
      store.signalWeights[sigKey] = Math.max(-0.3, Math.min(0.3, sigCurrent + sigDelta))
    }
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
  const settings = loadSettings()
  if (settings.lockedAtIndex !== null && settings.lockedAtIndex !== undefined) {
    saveSettings({ ...settings, lockedAtIndex: null })
  }
}

export function getSignalWeights() {
  return loadStore().signalWeights
}

// ─── 因果ノートの永続化 ──────────────────────────────────────

/**
 * 手動メモを localStorage から読込
 * @returns {object[]}
 */
export function loadCausalNotes() {
  try {
    const raw = localStorage.getItem(CAUSAL_NOTES_KEY)
    return raw ? JSON.parse(raw) : null  // null = 未保存 (初回は mock を使う)
  } catch {
    return null
  }
}

/**
 * 手動メモを localStorage に保存
 * @param {object[]} notes
 */
export function saveCausalNotes(notes) {
  try {
    localStorage.setItem(CAUSAL_NOTES_KEY, JSON.stringify(notes))
  } catch {}
}

/**
 * 手動却下された自動メモのキー一覧を取得
 * キー形式: `${date}_${patternType}_${app}`
 * @returns {string[]}
 */
export function loadRejectedAutoKeys() {
  try {
    const raw = localStorage.getItem(REJECTED_AUTO_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/**
 * 自動メモを手動却下したキーを追加
 * @param {string} key
 */
export function addRejectedAutoKey(key) {
  const keys = loadRejectedAutoKeys()
  if (!keys.includes(key)) {
    keys.push(key)
    // 最大200件に制限
    const trimmed = keys.length > 200 ? keys.slice(-200) : keys
    try {
      localStorage.setItem(REJECTED_AUTO_KEY, JSON.stringify(trimmed))
    } catch {}
  }
}

/**
 * 自動メモの安定キーを生成 (IDは毎回変わるため date+type+app で同定)
 */
export function autoMemoStableKey(memo) {
  return `${memo.date}_${memo.patternType}_${memo.app}`
}

// ─── エクスポート / インポート ────────────────────────────────

/**
 * 学習データ全体をエクスポート用オブジェクトとして取得
 */
export function exportLearningData() {
  const store = loadStore()
  const settings = loadSettings()
  return {
    _format: 'market-intel-learning-v1',
    exportedAt: new Date().toISOString(),
    store,
    settings,
  }
}

/**
 * エクスポートされた学習データをインポート（上書き）
 * @param {object} data - exportLearningData() の戻り値
 * @returns {{ success: boolean, message: string }}
 */
export function importLearningData(data) {
  if (!data || data._format !== 'market-intel-learning-v1') {
    return { success: false, message: 'フォーマットが不正です' }
  }
  if (!data.store || !data.settings) {
    return { success: false, message: 'データが不完全です' }
  }
  try {
    saveStore(data.store)
    saveSettings({ ...DEFAULT_SETTINGS, ...data.settings })
    return { success: true, message: `インポート完了 (${data.store.feedbackLog?.length || 0}件の学習ログ)` }
  } catch (e) {
    return { success: false, message: `インポート失敗: ${e.message}` }
  }
}
