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
 * スナップショット:
 *   snapshots: { name, timestamp, patternWeights, signalWeights, stats, feedbackLog }[]
 *   lockedSnapshot: string | null  — ロック中のスナップショット名 (学習を凍結)
 */

const STORAGE_KEY = 'market-intel-pattern-store'
const SETTINGS_KEY = 'market-intel-learning-settings'
const SNAPSHOTS_KEY = 'market-intel-learning-snapshots'

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

// ─── スナップショット ──────────────────────────────────────

function loadSnapshots() {
  try {
    const raw = localStorage.getItem(SNAPSHOTS_KEY)
    if (!raw) return { snapshots: [], lockedSnapshot: null }
    return JSON.parse(raw)
  } catch {
    return { snapshots: [], lockedSnapshot: null }
  }
}

function saveSnapshots(data) {
  try {
    localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(data))
  } catch {}
}

export function getSnapshots() {
  return loadSnapshots()
}

export function saveSnapshot(name) {
  const store = loadStore()
  const data = loadSnapshots()
  // 同名は上書き
  data.snapshots = data.snapshots.filter(s => s.name !== name)
  data.snapshots.push({
    name,
    timestamp: Date.now(),
    patternWeights: { ...store.patternWeights },
    signalWeights: { ...store.signalWeights },
    stats: { ...store.stats },
    feedbackLog: [...store.feedbackLog],
  })
  // 最大10個
  if (data.snapshots.length > 10) {
    data.snapshots = data.snapshots.slice(-10)
  }
  saveSnapshots(data)
  return data
}

export function restoreSnapshot(name) {
  const data = loadSnapshots()
  const snapshot = data.snapshots.find(s => s.name === name)
  if (!snapshot) return null
  const store = loadStore()
  store.patternWeights = { ...snapshot.patternWeights }
  store.signalWeights = { ...snapshot.signalWeights }
  store.stats = { ...snapshot.stats }
  store.feedbackLog = [...snapshot.feedbackLog]
  saveStore(store)
  return store
}

export function deleteSnapshot(name) {
  const data = loadSnapshots()
  data.snapshots = data.snapshots.filter(s => s.name !== name)
  if (data.lockedSnapshot === name) data.lockedSnapshot = null
  saveSnapshots(data)
  return data
}

export function lockSnapshot(name) {
  const data = loadSnapshots()
  const snapshot = data.snapshots.find(s => s.name === name)
  if (!snapshot) return data
  // ロック時、スナップショットの状態を適用
  restoreSnapshot(name)
  data.lockedSnapshot = name
  saveSnapshots(data)
  return data
}

export function unlockSnapshot() {
  const data = loadSnapshots()
  data.lockedSnapshot = null
  saveSnapshots(data)
  return data
}

export function isLearningLocked() {
  return loadSnapshots().lockedSnapshot !== null
}

export function getLockedSnapshotName() {
  return loadSnapshots().lockedSnapshot
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
}

export function getSignalWeights() {
  return loadStore().signalWeights
}
