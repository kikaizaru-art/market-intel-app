/**
 * アクション推奨エンジン
 *
 * 過去に記録した施策 (eventType 付きメモ) のその後のメトリクス変動を計測し、
 * 「過去に効いた施策」を現在の状況 (リスク/チャンス) に紐付けて推奨する。
 *
 * 設計:
 *  1. 施策記録の前後でメトリクス (週次トレンドの総和 or 月次レビュー) を比較 → 効果を算出
 *  2. eventType ごとに集計 → 試行回数・好影響率・平均効果・信頼度
 *  3. 現在の状況 (下降トレンド等) と照合して推奨/警告にラベル付け
 *
 * 入力データが少ない場合は空配列を返す。最低 2 件の計測可能な記録が必要。
 */

const TREND_WINDOW_WEEKS = 4
const REVIEW_WINDOW_MONTHS = 2
const NEUTRAL_THRESHOLD_PCT = 3
const MIN_TRIALS = 2

// ─── メトリクス計測 ────────────────────────────────────────

function sumTrendAtWeek(weekRow, genres) {
  if (!weekRow || !genres?.length) return 0
  let sum = 0
  for (const g of genres) {
    const v = Number(weekRow[g])
    if (Number.isFinite(v)) sum += v
  }
  return sum
}

/**
 * 指定日の前後の週次トレンド平均を取得
 */
function measureTrendEffect(weekly, genres, eventDate) {
  if (!Array.isArray(weekly) || !weekly.length) return null
  const eventTs = new Date(eventDate).getTime()
  if (!Number.isFinite(eventTs)) return null

  const enriched = weekly
    .map(w => ({ ...w, _ts: new Date(w.date).getTime() }))
    .filter(w => Number.isFinite(w._ts))

  const before = enriched.filter(w => w._ts < eventTs).slice(-TREND_WINDOW_WEEKS)
  const after  = enriched.filter(w => w._ts >= eventTs).slice(0, TREND_WINDOW_WEEKS)
  if (before.length < 2 || after.length < 2) return null

  const beforeAvg = before.reduce((s, w) => s + sumTrendAtWeek(w, genres), 0) / before.length
  const afterAvg  = after.reduce((s, w) => s + sumTrendAtWeek(w, genres), 0) / after.length
  if (!(beforeAvg > 0)) return null

  return {
    metric: 'trend_total',
    before: beforeAvg,
    after: afterAvg,
    deltaPct: ((afterAvg - beforeAvg) / beforeAvg) * 100,
    windowBefore: before.length,
    windowAfter: after.length,
  }
}

/**
 * 指定対象アプリのレビュー平均スコアを前後で比較
 */
function measureReviewEffect(reviewsData, appName, eventDate) {
  if (!appName || !reviewsData?.apps?.length) return null
  const app = reviewsData.apps.find(a => a.name === appName)
  const monthly = app?.monthly
  if (!Array.isArray(monthly) || monthly.length < 4) return null

  const eventYm = eventDate.slice(0, 7)
  const idx = monthly.findIndex(m => m.month >= eventYm)
  if (idx < 1) return null
  const before = monthly.slice(Math.max(0, idx - REVIEW_WINDOW_MONTHS), idx)
  const after  = monthly.slice(idx, idx + REVIEW_WINDOW_MONTHS)
  if (before.length < 1 || after.length < 1) return null

  const beforeScore = before.reduce((s, m) => s + Number(m.score || 0), 0) / before.length
  const afterScore  = after.reduce((s, m) => s + Number(m.score || 0), 0) / after.length
  if (!(beforeScore > 0)) return null

  return {
    metric: 'review_score',
    before: beforeScore,
    after: afterScore,
    deltaPct: ((afterScore - beforeScore) / beforeScore) * 100,
    windowBefore: before.length,
    windowAfter: after.length,
  }
}

/**
 * 単一の施策メモの「効果」を計測
 * レビューが測れればレビュー優先、なければトレンドをフォールバック
 */
export function measureActionEffect(note, { trendsData, reviewsData }) {
  if (!note?.eventType || !note.date) return null

  const reviewEffect = measureReviewEffect(reviewsData, note.app, note.date)
  if (reviewEffect) return withVerdict(reviewEffect)

  const weekly = trendsData?.weekly
  const genres = trendsData?._genres
    || (weekly?.[0] ? Object.keys(weekly[0]).filter(k => k !== 'date') : [])
  const trendEffect = measureTrendEffect(weekly, genres, note.date)
  if (trendEffect) return withVerdict(trendEffect)

  return null
}

function withVerdict(effect) {
  const d = effect.deltaPct
  const verdict = d > NEUTRAL_THRESHOLD_PCT ? 'positive'
    : d < -NEUTRAL_THRESHOLD_PCT ? 'negative'
    : 'neutral'
  return {
    ...effect,
    deltaPct: Math.round(d * 10) / 10,
    verdict,
  }
}

// ─── 集計とランキング ────────────────────────────────────────

function aggregateByEventType(samples) {
  const map = {}
  for (const { note, effect } of samples) {
    const key = note.eventType
    if (!map[key]) {
      map[key] = {
        eventType: key,
        trials: 0,
        positive: 0,
        negative: 0,
        neutral: 0,
        deltaSum: 0,
        latestDate: note.date,
        samples: [],
      }
    }
    const a = map[key]
    a.trials++
    a[effect.verdict]++
    a.deltaSum += effect.deltaPct
    if (note.date > a.latestDate) a.latestDate = note.date
    a.samples.push({
      date: note.date,
      event: note.event,
      app: note.app,
      metric: effect.metric,
      deltaPct: effect.deltaPct,
      verdict: effect.verdict,
    })
  }
  return Object.values(map).map(a => ({
    ...a,
    avgDelta: Math.round((a.deltaSum / a.trials) * 10) / 10,
    positiveRate: Math.round((a.positive / a.trials) * 100),
    samples: a.samples.sort((x, y) => y.date.localeCompare(x.date)),
  }))
}

/**
 * 信頼度スコア (0〜1)
 * 試行数の飽和 × 好影響率 × 効果量 (±20% で正規化)
 */
function confidenceScore(agg) {
  const sampleFactor = agg.trials / (agg.trials + 3)
  const rateFactor = Math.max(agg.positiveRate, 100 - agg.positiveRate) / 100
  const magnitudeFactor = Math.min(1, Math.abs(agg.avgDelta) / 20)
  return Math.round(sampleFactor * rateFactor * magnitudeFactor * 100) / 100
}

/**
 * 現在の状態に対する推奨アクションを生成
 *
 * @param {object} params
 * @param {object[]} params.notes - 因果メモ (eventType を持つものを利用)
 * @param {object} params.trendsData
 * @param {object} params.reviewsData
 * @param {object[]} params.risks - { type, genre, ... }
 * @param {object[]} params.opportunities - { genre, ... }
 * @returns {object[]} 推奨アクションの配列 (信頼度降順)
 */
export function recommendActions({ notes, trendsData, reviewsData, risks = [], opportunities = [] }) {
  if (!Array.isArray(notes) || !notes.length) return []
  const actionable = notes.filter(n => n?.eventType)
  if (!actionable.length) return []

  const samples = actionable
    .map(note => ({ note, effect: measureActionEffect(note, { trendsData, reviewsData }) }))
    .filter(x => x.effect)

  if (samples.length < MIN_TRIALS) return []

  const aggregated = aggregateByEventType(samples)

  const hasRisk = (risks?.length || 0) > 0
  const hasOpp = (opportunities?.length || 0) > 0

  return aggregated
    .filter(a => a.trials >= MIN_TRIALS)
    .map(a => {
      const confidence = confidenceScore(a)
      const isProven = a.positiveRate >= 50 && a.avgDelta > NEUTRAL_THRESHOLD_PCT
      const isRisky  = a.positiveRate < 40 || a.avgDelta < -NEUTRAL_THRESHOLD_PCT

      let match = null
      if (isRisky) {
        match = { kind: 'warning', label: '過去に逆効果だった施策' }
      } else if (isProven && hasRisk) {
        match = { kind: 'risk', label: '現在の逆風に対して有効' }
      } else if (isProven && hasOpp) {
        match = { kind: 'opportunity', label: '現在の追い風を強化' }
      } else if (isProven) {
        match = { kind: 'stable', label: '過去に効いた施策' }
      }

      return {
        eventType: a.eventType,
        trials: a.trials,
        positive: a.positive,
        negative: a.negative,
        neutral: a.neutral,
        positiveRate: a.positiveRate,
        avgDelta: a.avgDelta,
        confidence,
        isProven,
        isRisky,
        match,
        latestDate: a.latestDate,
        recentSamples: a.samples.slice(0, 3),
      }
    })
    .sort((a, b) => {
      if (a.isRisky !== b.isRisky) return a.isRisky ? 1 : -1
      return b.confidence - a.confidence
    })
}

/**
 * 計測対象の施策件数と計測済み件数を返す (UI の空状態メッセージ用)
 */
export function countActionableSamples(notes, { trendsData, reviewsData }) {
  const actionable = (notes || []).filter(n => n?.eventType)
  const measured = actionable.filter(n => measureActionEffect(n, { trendsData, reviewsData }))
  return { actionable: actionable.length, measured: measured.length }
}
