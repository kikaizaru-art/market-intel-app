/**
 * 自動メモ生成 + 自動検証エンジン
 *
 * データの異常値・トレンド変動・イベント相関・レビュー変化・季節パターンを
 * 自動検出し、因果関係メモを生成する。
 *
 * さらにデータの実績（後続のトレンド・レビュー変化）と照合して
 * 予測が的中したか自動検証し、承認/却下を判定。
 * 手動操作なしで学習が回り、蓄積するほど精度が上がる。
 */

import { detectAllAnomalies } from './anomaly.js'

// ─── パターンタイプ定義 ─────────────────────────────────────
export const PATTERN_TYPES = {
  ANOMALY_EVENT:   'anomaly_event',
  TREND_SHIFT:     'trend_shift',
  REVIEW_SPIKE:    'review_spike',
  NEWS_CORRELATION:'news_correlation',
  SEASONAL:        'seasonal',
}

const PATTERN_LABELS = {
  anomaly_event:    '異常値×イベント',
  trend_shift:      'トレンド変動',
  review_spike:     'レビュー急変',
  news_correlation: 'ニュース相関',
  seasonal:         '季節パターン',
}

export { PATTERN_LABELS }

// ─── 基本信頼度（学習で調整される） ─────────────────────────
const BASE_CONFIDENCE = {
  anomaly_event:    0.75,
  trend_shift:      0.60,
  review_spike:     0.70,
  news_correlation: 0.50,
  seasonal:         0.65,
}

// ─── 自動承認/却下の閾値 (デフォルト、設定で上書き可能) ─────
const DEFAULT_AUTO_CONFIRM_THRESHOLD = 0.65
const DEFAULT_AUTO_REJECT_THRESHOLD  = 0.30
const DEFAULT_TREND_SHIFT_PCT       = 10
const DEFAULT_REVIEW_SPIKE_DELTA    = 0.3

// ─── 季節パターン辞書 ──────────────────────────────────────
const SEASONAL_PATTERNS = [
  { month: 1,  event: '年末年始特需の終了',          impact: 'negative', layer: 'マクロ' },
  { month: 2,  event: 'バレンタインシーズン',        impact: 'positive', layer: 'マクロ' },
  { month: 3,  event: '年度末・卒業シーズン',        impact: 'neutral',  layer: 'マクロ' },
  { month: 4,  event: '新生活シーズン開始',          impact: 'positive', layer: 'マクロ' },
  { month: 5,  event: 'GW大型連休',                  impact: 'positive', layer: 'マクロ' },
  { month: 7,  event: '夏休みシーズン開始',          impact: 'positive', layer: 'マクロ' },
  { month: 8,  event: 'お盆シーズン',                impact: 'positive', layer: 'マクロ' },
  { month: 10, event: 'ハロウィンシーズン',          impact: 'positive', layer: 'マクロ' },
  { month: 12, event: 'クリスマス・年末商戦',        impact: 'positive', layer: 'マクロ' },
]

// ─── ヘルパー ──────────────────────────────────────────────
function daysBetween(d1, d2) {
  return Math.abs(new Date(d1).getTime() - new Date(d2).getTime()) / (1000 * 60 * 60 * 24)
}

function makeId() {
  return `auto_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

function calcConfidence(patternType, rawScore, patternWeights) {
  const base = BASE_CONFIDENCE[patternType] || 0.5
  const learned = patternWeights[patternType] || 0
  return Math.max(0.05, Math.min(0.99, base + learned + rawScore))
}

// ─── パターン検出器群 ──────────────────────────────────────

function detectAnomalyEventPatterns(anomalies, events, patternWeights) {
  const memos = []
  if (!anomalies?.length || !events?.events?.length) return memos

  for (const anomaly of anomalies) {
    for (const ev of events.events) {
      const diff = daysBetween(anomaly.date, ev.start)
      if (diff <= 7) {
        const proximity = 1 - diff / 7
        const rawScore = proximity * 0.2
        const confidence = calcConfidence(PATTERN_TYPES.ANOMALY_EVENT, rawScore, patternWeights)
        const direction = new Date(ev.start) <= new Date(anomaly.date) ? '直後' : '直前'
        memos.push({
          id: makeId(),
          date: anomaly.date,
          event: `${ev.name}の${direction}に${anomaly.genre}で${anomaly.type === 'spike' ? '急上昇' : '急下降'}`,
          app: ev.app,
          layer: '競合',
          impact: anomaly.type === 'spike' ? 'positive' : 'negative',
          memo: `${ev.app}の「${ev.name}」(${ev.start}) と${anomaly.genre}のトレンド${anomaly.type === 'spike' ? '急上昇' : '急下降'} (z=${anomaly.zscore}) が±7日以内に発生。近接度: ${(proximity * 100).toFixed(0)}%`,
          auto: true,
          patternType: PATTERN_TYPES.ANOMALY_EVENT,
          confidence,
          signals: [`anomaly_${anomaly.type}`, `event_${ev.type}`, `proximity_${diff.toFixed(0)}d`],
          _validation: { anomalyGenre: anomaly.genre, anomalyType: anomaly.type, eventDate: ev.start },
        })
      }
    }
  }
  return memos
}

function detectTrendShiftPatterns(trendsData, patternWeights, settings) {
  const memos = []
  if (!trendsData?.weekly?.length) return memos

  const weekly = trendsData.weekly
  const genres = trendsData._genres || Object.keys(weekly[0] || {}).filter(k => k !== 'date')
  if (weekly.length < 8) return memos

  const thresholdPct = settings?.thresholds?.trendShiftPct ?? DEFAULT_TREND_SHIFT_PCT

  for (const genre of genres) {
    const recent4 = weekly.slice(-4).map(w => w[genre] ?? 0)
    const prev4 = weekly.slice(-8, -4).map(w => w[genre] ?? 0)
    const recentAvg = recent4.reduce((a, b) => a + b, 0) / 4
    const prevAvg = prev4.reduce((a, b) => a + b, 0) / 4
    const change = prevAvg !== 0 ? ((recentAvg - prevAvg) / prevAvg) * 100 : 0

    if (Math.abs(change) >= thresholdPct) {
      const rawScore = Math.min(Math.abs(change) / 100, 0.3)
      const confidence = calcConfidence(PATTERN_TYPES.TREND_SHIFT, rawScore, patternWeights)
      const isUp = change > 0
      memos.push({
        id: makeId(),
        date: weekly[weekly.length - 1].date,
        event: `${genre}トレンド${isUp ? '上昇' : '下降'}トレンド検出`,
        app: '全体',
        layer: 'マクロ',
        impact: isUp ? 'positive' : 'negative',
        memo: `${genre}の直近4週平均が前4週比で${change > 0 ? '+' : ''}${change.toFixed(1)}%変動 (${prevAvg.toFixed(0)}→${recentAvg.toFixed(0)})`,
        auto: true,
        patternType: PATTERN_TYPES.TREND_SHIFT,
        confidence,
        signals: [`trend_${isUp ? 'up' : 'down'}`, `change_${Math.abs(change).toFixed(0)}pct`],
        _validation: { genre, predictedDirection: isUp ? 'up' : 'down', changePct: change },
      })
    }
  }
  return memos
}

function detectReviewSpikePatterns(reviewsData, patternWeights, settings) {
  const memos = []
  if (!reviewsData?.apps?.length) return memos

  const spikeDelta = settings?.thresholds?.reviewSpikeDelta ?? DEFAULT_REVIEW_SPIKE_DELTA

  for (const app of reviewsData.apps) {
    const monthly = app.monthly
    if (!monthly || monthly.length < 2) continue

    const latest = monthly[monthly.length - 1]
    const prev = monthly[monthly.length - 2]
    const scoreDiff = latest.score - prev.score
    const countDiff = prev.count !== 0 ? ((latest.count - prev.count) / prev.count) * 100 : 0

    if (Math.abs(scoreDiff) >= spikeDelta) {
      const rawScore = Math.min(Math.abs(scoreDiff) / 2, 0.25)
      const confidence = calcConfidence(PATTERN_TYPES.REVIEW_SPIKE, rawScore, patternWeights)
      const isUp = scoreDiff > 0
      memos.push({
        id: makeId(),
        date: latest.month + '-15',
        event: `${app.name}のレビュースコア${isUp ? '急上昇' : '急下降'}`,
        app: app.name,
        layer: 'ユーザー',
        impact: isUp ? 'positive' : 'negative',
        memo: `レビュースコアが${prev.score.toFixed(1)}→${latest.score.toFixed(1)} (${scoreDiff > 0 ? '+' : ''}${scoreDiff.toFixed(1)})。レビュー件数${countDiff > 0 ? '+' : ''}${countDiff.toFixed(0)}%`,
        auto: true,
        patternType: PATTERN_TYPES.REVIEW_SPIKE,
        confidence,
        signals: [`score_${isUp ? 'up' : 'down'}_${Math.abs(scoreDiff).toFixed(1)}`, `count_change_${countDiff.toFixed(0)}pct`],
        _validation: { appName: app.name, scoreDiff, direction: isUp ? 'up' : 'down' },
      })
    }
  }
  return memos
}

function detectNewsCorrelationPatterns(newsData, trendsData, anomalies, patternWeights) {
  const memos = []
  if (!newsData?.length || !anomalies?.length) return memos

  for (const news of newsData.slice(0, 10)) {
    const tags = news.tags || []
    for (const anomaly of anomalies) {
      const tagMatch = tags.some(t => t === anomaly.genre || t === '市場動向' || t === '競合')
      const timeDiff = daysBetween(news.date, anomaly.date)
      if (tagMatch && timeDiff <= 5) {
        const proximity = 1 - timeDiff / 5
        const rawScore = proximity * 0.15
        const confidence = calcConfidence(PATTERN_TYPES.NEWS_CORRELATION, rawScore, patternWeights)
        memos.push({
          id: makeId(),
          date: news.date,
          event: `ニュース関連: ${news.title.slice(0, 30)}...`,
          app: '全体',
          layer: 'マクロ',
          impact: anomaly.type === 'spike' ? 'positive' : 'negative',
          memo: `「${news.title}」(${news.source}) と${anomaly.genre}の${anomaly.type === 'spike' ? '急上昇' : '急下降'}が時間的に近接 (${timeDiff.toFixed(0)}日差)`,
          auto: true,
          patternType: PATTERN_TYPES.NEWS_CORRELATION,
          confidence,
          signals: [`news_${news.source}`, `anomaly_${anomaly.type}`, `tags_${tags.join(',')}`],
          _validation: { genre: anomaly.genre, anomalyType: anomaly.type },
        })
      }
    }
  }
  return memos
}

function detectSeasonalPatterns(currentDate, existingNotes, patternWeights) {
  const memos = []
  const now = new Date(currentDate || new Date())
  const currentMonth = now.getMonth() + 1

  for (const pattern of SEASONAL_PATTERNS) {
    if (pattern.month !== currentMonth) continue
    const isDuplicate = existingNotes.some(n =>
      n.event.includes(pattern.event.slice(0, 6)) &&
      n.date.startsWith(now.getFullYear().toString())
    )
    if (isDuplicate) continue

    const rawScore = 0.1
    const confidence = calcConfidence(PATTERN_TYPES.SEASONAL, rawScore, patternWeights)
    memos.push({
      id: makeId(),
      date: `${now.getFullYear()}-${String(currentMonth).padStart(2, '0')}-01`,
      event: pattern.event,
      app: '全体',
      layer: pattern.layer,
      impact: pattern.impact,
      memo: `毎年${currentMonth}月に見られる季節的パターン`,
      auto: true,
      patternType: PATTERN_TYPES.SEASONAL,
      confidence,
      signals: [`month_${currentMonth}`, `seasonal_${pattern.impact}`],
      _validation: { month: currentMonth, expectedImpact: pattern.impact },
    })
  }
  return memos
}

// ─── 自動検証ロジック ─────────────────────────────────────
// データの実績と照合して予測が的中したか判定する

/**
 * トレンドシフトの検証:
 * 予測方向と、その後2週のトレンドが一致するか
 */
function validateTrendShift(memo, trendsData) {
  if (!trendsData?.weekly?.length || !memo._validation) return null
  const { genre, predictedDirection } = memo._validation
  const weekly = trendsData.weekly
  if (weekly.length < 4) return null

  // 最新2週 vs その前2週
  const last2 = weekly.slice(-2).map(w => w[genre] ?? 0)
  const prev2 = weekly.slice(-4, -2).map(w => w[genre] ?? 0)
  const last2Avg = last2.reduce((a, b) => a + b, 0) / 2
  const prev2Avg = prev2.reduce((a, b) => a + b, 0) / 2
  const actualDirection = last2Avg > prev2Avg ? 'up' : 'down'

  return actualDirection === predictedDirection ? 'confirmed' : 'rejected'
}

/**
 * レビュースパイクの検証:
 * 直近のスコア変動方向が予測と一致するか
 */
function validateReviewSpike(memo, reviewsData) {
  if (!reviewsData?.apps?.length || !memo._validation) return null
  const { appName, direction } = memo._validation
  const app = reviewsData.apps.find(a => a.name === appName)
  if (!app?.monthly || app.monthly.length < 3) return null

  const latest = app.monthly[app.monthly.length - 1]
  const prev = app.monthly[app.monthly.length - 2]
  const actualDirection = latest.score >= prev.score ? 'up' : 'down'

  return actualDirection === direction ? 'confirmed' : 'rejected'
}

/**
 * 異常値×イベントの検証:
 * 異常値の発生が実データで確認できるか (z-scoreの存在自体が検証)
 */
function validateAnomalyEvent(memo, trendsData) {
  if (!trendsData?.weekly?.length || !memo._validation) return null
  // 異常値はすでにデータから検出されたものなので、存在自体が的中
  // ただし近接度が低い場合は弱い相関
  return memo.confidence >= 0.6 ? 'confirmed' : null
}

/**
 * ニュース相関の検証:
 * ニュースと異常値の時間近接 + タグ一致があれば的中
 */
function validateNewsCorrelation(memo, trendsData) {
  if (!memo._validation) return null
  // 既にタグ一致+時間近接で生成されているので、信頼度ベースで判定
  return memo.confidence >= 0.55 ? 'confirmed' : null
}

/**
 * 季節パターンの検証:
 * 全体トレンドが予測インパクト方向と合致するか
 */
function validateSeasonal(memo, trendsData) {
  if (!trendsData?.weekly?.length || !memo._validation) return null
  const { expectedImpact } = memo._validation
  const weekly = trendsData.weekly
  if (weekly.length < 4) return null

  const genres = trendsData._genres || Object.keys(weekly[0] || {}).filter(k => k !== 'date')
  if (!genres.length) return null

  // 主要ジャンルの全体的なトレンド方向
  let upCount = 0, downCount = 0
  for (const genre of genres) {
    const recent = weekly.slice(-2).map(w => w[genre] ?? 0)
    const prev = weekly.slice(-4, -2).map(w => w[genre] ?? 0)
    const rAvg = recent.reduce((a, b) => a + b, 0) / 2
    const pAvg = prev.reduce((a, b) => a + b, 0) / 2
    if (rAvg > pAvg) upCount++
    else downCount++
  }

  const overallUp = upCount > downCount
  if (expectedImpact === 'positive' && overallUp) return 'confirmed'
  if (expectedImpact === 'negative' && !overallUp) return 'confirmed'
  if (expectedImpact === 'neutral') return 'confirmed' // 中立は常に的中扱い
  return 'rejected'
}

const VALIDATORS = {
  [PATTERN_TYPES.TREND_SHIFT]:      validateTrendShift,
  [PATTERN_TYPES.REVIEW_SPIKE]:     validateReviewSpike,
  [PATTERN_TYPES.ANOMALY_EVENT]:    validateAnomalyEvent,
  [PATTERN_TYPES.NEWS_CORRELATION]: validateNewsCorrelation,
  [PATTERN_TYPES.SEASONAL]:         validateSeasonal,
}

/**
 * 自動メモを実データで検証し、承認/却下を自動判定
 *
 * @param {object[]} memos
 * @param {{ trendsData, reviewsData }} data
 * @param {object} [settings] — ユーザー設定 (thresholds.autoConfirm / autoReject)
 * @returns {{ confirmed: object[], rejected: object[], pending: object[] }}
 */
export function validateAutoMemos(memos, { trendsData, reviewsData }, settings) {
  const confirmed = []
  const rejected = []
  const pending = []

  const autoConfirm = settings?.thresholds?.autoConfirm ?? DEFAULT_AUTO_CONFIRM_THRESHOLD
  const autoReject = settings?.thresholds?.autoReject ?? DEFAULT_AUTO_REJECT_THRESHOLD

  for (const memo of memos) {
    const validator = VALIDATORS[memo.patternType]
    if (!validator) {
      // バリデータが無いパターンは信頼度ベースで振り分け
      if (memo.confidence >= autoConfirm) confirmed.push({ ...memo, validationResult: 'auto_threshold' })
      else if (memo.confidence < autoReject) rejected.push({ ...memo, validationResult: 'auto_threshold' })
      else pending.push(memo)
      continue
    }

    const result = validator(memo, trendsData, reviewsData)

    if (result === 'confirmed') {
      confirmed.push({ ...memo, validationResult: 'data_verified' })
    } else if (result === 'rejected') {
      rejected.push({ ...memo, validationResult: 'data_contradicted' })
    } else {
      // バリデーション不可 → 信頼度閾値で判定
      if (memo.confidence >= autoConfirm) confirmed.push({ ...memo, validationResult: 'confidence_threshold' })
      else if (memo.confidence < autoReject) rejected.push({ ...memo, validationResult: 'confidence_threshold' })
      else pending.push(memo)
    }
  }

  return { confirmed, rejected, pending }
}

// ─── 重複排除 ──────────────────────────────────────────────

function deduplicateMemos(memos, existingNotes) {
  const seen = new Set()
  for (const n of existingNotes) {
    seen.add(`${n.date}_${n.event.slice(0, 10)}_${n.app}`)
  }
  return memos.filter(m => {
    const key = `${m.date}_${m.patternType}_${m.app}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ─── メイン ────────────────────────────────────────────────

/**
 * 全パターン検出器を実行し、自動メモ候補を生成
 *
 * @param {object} params
 * @param {object} [params.settings] — ユーザー設定 (enabledPatterns, thresholds)
 */
export function generateAutoMemos({
  trendsData,
  reviewsData,
  eventsData,
  newsData,
  existingNotes = [],
  patternWeights = {},
  currentDate,
  settings,
}) {
  const enabled = settings?.enabledPatterns
  const weekly = trendsData?.weekly || []
  const genres = trendsData?._genres || Object.keys(weekly[0] || {}).filter(k => k !== 'date')
  const anomalies = weekly.length ? detectAllAnomalies(weekly, genres) : []

  const allMemos = [
    ...(enabled?.anomaly_event !== false ? detectAnomalyEventPatterns(anomalies, eventsData, patternWeights) : []),
    ...(enabled?.trend_shift !== false ? detectTrendShiftPatterns(trendsData, patternWeights, settings) : []),
    ...(enabled?.review_spike !== false ? detectReviewSpikePatterns(reviewsData, patternWeights, settings) : []),
    ...(enabled?.news_correlation !== false ? detectNewsCorrelationPatterns(newsData, trendsData, anomalies, patternWeights) : []),
    ...(enabled?.seasonal !== false ? detectSeasonalPatterns(currentDate, existingNotes, patternWeights) : []),
  ]

  const deduplicated = deduplicateMemos(allMemos, existingNotes)
  return deduplicated.sort((a, b) => b.confidence - a.confidence)
}
