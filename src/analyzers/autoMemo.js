/**
 * 自動メモ生成エンジン
 *
 * データの異常値・トレンド変動・イベント相関・レビュー変化・季節パターンを
 * 自動検出し、因果関係メモ候補を生成する。
 * ユーザーの承認/却下フィードバックで信頼度を学習し精度が向上する。
 */

import { detectAllAnomalies } from './anomaly.js'

// ─── パターンタイプ定義 ─────────────────────────────────────
export const PATTERN_TYPES = {
  ANOMALY_EVENT:   'anomaly_event',    // 異常値 × イベント相関
  TREND_SHIFT:     'trend_shift',      // トレンド方向転換
  REVIEW_SPIKE:    'review_spike',     // レビュースコア急変
  NEWS_CORRELATION:'news_correlation', // ニュース × データ変動
  SEASONAL:        'seasonal',         // 季節パターン
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

/**
 * 学習済みパターン重みを適用した信頼度を算出
 */
function calcConfidence(patternType, rawScore, patternWeights) {
  const base = BASE_CONFIDENCE[patternType] || 0.5
  const learned = patternWeights[patternType] || 0
  return Math.max(0.05, Math.min(0.99, base + learned + rawScore))
}

// ─── パターン検出器群 ──────────────────────────────────────

/**
 * 1) 異常値 × イベント相関
 *    トレンドの異常値と時間的に近いイベントを因果関係候補として提示
 */
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
          status: 'pending',
          signals: [`anomaly_${anomaly.type}`, `event_${ev.type}`, `proximity_${diff.toFixed(0)}d`],
        })
      }
    }
  }
  return memos
}

/**
 * 2) トレンド方向転換検出
 *    直近4週 vs 前4週を比較し、有意な変動を検出
 */
function detectTrendShiftPatterns(trendsData, patternWeights) {
  const memos = []
  if (!trendsData?.weekly?.length) return memos

  const weekly = trendsData.weekly
  const genres = trendsData._genres || Object.keys(weekly[0] || {}).filter(k => k !== 'date')
  if (weekly.length < 8) return memos

  for (const genre of genres) {
    const recent4 = weekly.slice(-4).map(w => w[genre] ?? 0)
    const prev4 = weekly.slice(-8, -4).map(w => w[genre] ?? 0)
    const recentAvg = recent4.reduce((a, b) => a + b, 0) / 4
    const prevAvg = prev4.reduce((a, b) => a + b, 0) / 4
    const change = prevAvg !== 0 ? ((recentAvg - prevAvg) / prevAvg) * 100 : 0

    if (Math.abs(change) >= 10) {
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
        status: 'pending',
        signals: [`trend_${isUp ? 'up' : 'down'}`, `change_${Math.abs(change).toFixed(0)}pct`],
      })
    }
  }
  return memos
}

/**
 * 3) レビュースコア急変検出
 *    直近月 vs 前月のスコア変動を検出
 */
function detectReviewSpikePatterns(reviewsData, patternWeights) {
  const memos = []
  if (!reviewsData?.apps?.length) return memos

  for (const app of reviewsData.apps) {
    const monthly = app.monthly
    if (!monthly || monthly.length < 2) continue

    const latest = monthly[monthly.length - 1]
    const prev = monthly[monthly.length - 2]
    const scoreDiff = latest.score - prev.score
    const countDiff = prev.count !== 0 ? ((latest.count - prev.count) / prev.count) * 100 : 0

    if (Math.abs(scoreDiff) >= 0.3) {
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
        status: 'pending',
        signals: [`score_${isUp ? 'up' : 'down'}_${Math.abs(scoreDiff).toFixed(1)}`, `count_change_${countDiff.toFixed(0)}pct`],
      })
    }
  }
  return memos
}

/**
 * 4) ニュース × トレンド相関
 *    ニュースタグとトレンドジャンルの一致 + 時間近接度
 */
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
          status: 'pending',
          signals: [`news_${news.source}`, `anomaly_${anomaly.type}`, `tags_${tags.join(',')}`],
        })
      }
    }
  }
  return memos
}

/**
 * 5) 季節パターン検出
 *    現在月に該当する既知の季節パターンを提示
 */
function detectSeasonalPatterns(currentDate, existingNotes, patternWeights) {
  const memos = []
  const now = new Date(currentDate || new Date())
  const currentMonth = now.getMonth() + 1

  for (const pattern of SEASONAL_PATTERNS) {
    if (pattern.month !== currentMonth) continue

    // 既存メモに同じ季節パターンがあればスキップ
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
      memo: `毎年${currentMonth}月に見られる季節的パターン。過去の傾向と照合して影響を確認してください`,
      auto: true,
      patternType: PATTERN_TYPES.SEASONAL,
      confidence,
      status: 'pending',
      signals: [`month_${currentMonth}`, `seasonal_${pattern.impact}`],
    })
  }
  return memos
}

// ─── 重複排除 ──────────────────────────────────────────────

/**
 * 同一日・同一パターンタイプ・同一アプリの重複を除去
 */
function deduplicateMemos(memos, existingNotes) {
  const seen = new Set()

  // 既存手動メモのキーも除外対象
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
 * @param {object} params.trendsData     - トレンドデータ
 * @param {object} params.reviewsData    - レビューデータ
 * @param {object} params.eventsData     - イベントカレンダー
 * @param {Array}  params.newsData       - ニュースデータ
 * @param {Array}  params.existingNotes  - 既存の手動メモ
 * @param {object} params.patternWeights - 学習済みパターン重み
 * @param {string} params.currentDate    - 現在日付
 * @returns {object[]} 自動メモ候補リスト（信頼度降順）
 */
export function generateAutoMemos({
  trendsData,
  reviewsData,
  eventsData,
  newsData,
  existingNotes = [],
  patternWeights = {},
  currentDate,
}) {
  // トレンドから異常値を抽出
  const weekly = trendsData?.weekly || []
  const genres = trendsData?._genres || Object.keys(weekly[0] || {}).filter(k => k !== 'date')
  const anomalies = weekly.length ? detectAllAnomalies(weekly, genres) : []

  // 各パターン検出器を実行
  const allMemos = [
    ...detectAnomalyEventPatterns(anomalies, eventsData, patternWeights),
    ...detectTrendShiftPatterns(trendsData, patternWeights),
    ...detectReviewSpikePatterns(reviewsData, patternWeights),
    ...detectNewsCorrelationPatterns(newsData, trendsData, anomalies, patternWeights),
    ...detectSeasonalPatterns(currentDate, existingNotes, patternWeights),
  ]

  // 重複排除 → 信頼度降順ソート
  const deduplicated = deduplicateMemos(allMemos, existingNotes)
  return deduplicated.sort((a, b) => b.confidence - a.confidence)
}
