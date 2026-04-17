/**
 * アクション推奨エンジン
 *
 * 過去に記録した施策 (eventType 付きメモ) のその後のメトリクス変動を計測し、
 * 「過去に効いた施策」を現在の状況 (リスク/チャンス) に紐付けて推奨する。
 *
 * 設計:
 *  1. 施策前後のメトリクス (週次トレンド or 月次レビュー) を比較 → 生の効果 (rawDelta)
 *  2. 同時期の市場全体の動きを計測 → 外部要因 (baselineDelta)
 *     - レビュー: 競合アプリの平均スコア変化
 *     - トレンド: 対象以外のジャンルの平均変化
 *  3. 純効果 = 生の効果 − 外部要因 → 「市場追い風/逆風を差し引いた施策固有の効果」
 *  4. eventType ごとに集計 → 試行回数・好影響率・平均純効果・信頼度
 *  5. 現在の状況 (下降トレンド等) と照合して推奨/警告にラベル付け
 *
 * ビジョン文脈: 「そのアクションが本当に効いたのか、外部要因だったのか」を分離するのが目的。
 * 基準値が計測できない場合 (単一アプリ・単一ジャンル) は rawDelta をそのまま純効果として扱う。
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

function avgDeltaPct(before, after) {
  if (!Number.isFinite(before) || !Number.isFinite(after) || !(before > 0)) return null
  return ((after - before) / before) * 100
}

/**
 * 指定日前後の週次トレンドを計測
 * 対象ジャンルが指定できれば「そのジャンル vs 他ジャンル平均」で市場補正を行う
 */
function measureTrendEffect(weekly, allGenres, eventDate, targetGenre) {
  if (!Array.isArray(weekly) || !weekly.length || !allGenres?.length) return null
  const eventTs = new Date(eventDate).getTime()
  if (!Number.isFinite(eventTs)) return null

  const enriched = weekly
    .map(w => ({ ...w, _ts: new Date(w.date).getTime() }))
    .filter(w => Number.isFinite(w._ts))

  const before = enriched.filter(w => w._ts < eventTs).slice(-TREND_WINDOW_WEEKS)
  const after  = enriched.filter(w => w._ts >= eventTs).slice(0, TREND_WINDOW_WEEKS)
  if (before.length < 2 || after.length < 2) return null

  const hasTarget = targetGenre && allGenres.includes(targetGenre)
  const targetGenres = hasTarget ? [targetGenre] : allGenres

  const beforeAvg = before.reduce((s, w) => s + sumTrendAtWeek(w, targetGenres), 0) / before.length
  const afterAvg  = after.reduce((s, w) => s + sumTrendAtWeek(w, targetGenres), 0) / after.length
  const rawDelta = avgDeltaPct(beforeAvg, afterAvg)
  if (rawDelta == null) return null

  // 市場 baseline: 対象以外のジャンル平均変化 (対象ジャンル指定時のみ計測)
  let baselineDelta = null
  if (hasTarget) {
    const otherGenres = allGenres.filter(g => g !== targetGenre)
    if (otherGenres.length >= 1) {
      const beforeOther = before.reduce((s, w) => s + sumTrendAtWeek(w, otherGenres), 0) / before.length / otherGenres.length
      const afterOther  = after.reduce((s, w) => s + sumTrendAtWeek(w, otherGenres), 0) / after.length / otherGenres.length
      baselineDelta = avgDeltaPct(beforeOther, afterOther)
    }
  }

  return buildEffect({
    metric: hasTarget ? 'trend_genre' : 'trend_total',
    before: beforeAvg,
    after: afterAvg,
    rawDelta,
    baselineDelta,
    windowBefore: before.length,
    windowAfter: after.length,
  })
}

function computeAppReviewDelta(app, eventYm) {
  const monthly = app?.monthly
  if (!Array.isArray(monthly) || monthly.length < 2) return null
  const idx = monthly.findIndex(m => m.month >= eventYm)
  if (idx < 1) return null
  const before = monthly.slice(Math.max(0, idx - REVIEW_WINDOW_MONTHS), idx)
  const after  = monthly.slice(idx, idx + REVIEW_WINDOW_MONTHS)
  if (before.length < 1 || after.length < 1) return null
  const beforeScore = before.reduce((s, m) => s + Number(m.score || 0), 0) / before.length
  const afterScore  = after.reduce((s, m) => s + Number(m.score || 0), 0) / after.length
  const delta = avgDeltaPct(beforeScore, afterScore)
  if (delta == null) return null
  return { before: beforeScore, after: afterScore, delta, windowBefore: before.length, windowAfter: after.length }
}

/**
 * 指定対象アプリのレビュー平均スコアを前後で比較
 * 他アプリの同時期変化で市場補正を行う
 */
function measureReviewEffect(reviewsData, appName, eventDate) {
  if (!appName || !reviewsData?.apps?.length) return null
  const target = reviewsData.apps.find(a => a.name === appName)
  if (!target) return null

  const eventYm = eventDate.slice(0, 7)
  const targetMeasure = computeAppReviewDelta(target, eventYm)
  if (!targetMeasure) return null

  const otherDeltas = reviewsData.apps
    .filter(a => a.name !== appName)
    .map(a => computeAppReviewDelta(a, eventYm))
    .filter(x => x)
    .map(x => x.delta)

  const baselineDelta = otherDeltas.length
    ? otherDeltas.reduce((s, d) => s + d, 0) / otherDeltas.length
    : null

  return buildEffect({
    metric: 'review_score',
    before: targetMeasure.before,
    after: targetMeasure.after,
    rawDelta: targetMeasure.delta,
    baselineDelta,
    windowBefore: targetMeasure.windowBefore,
    windowAfter: targetMeasure.windowAfter,
  })
}

function buildEffect({ metric, before, after, rawDelta, baselineDelta, windowBefore, windowAfter }) {
  const netDelta = baselineDelta != null ? rawDelta - baselineDelta : rawDelta
  // 判定・ランキングに使う主指標は「市場補正後の純効果」
  const verdict = netDelta > NEUTRAL_THRESHOLD_PCT ? 'positive'
    : netDelta < -NEUTRAL_THRESHOLD_PCT ? 'negative'
    : 'neutral'
  return {
    metric,
    before,
    after,
    rawDelta: round1(rawDelta),
    baselineDelta: baselineDelta != null ? round1(baselineDelta) : null,
    netDelta: round1(netDelta),
    // 既存 API 互換: deltaPct は純効果を指す
    deltaPct: round1(netDelta),
    verdict,
    windowBefore,
    windowAfter,
  }
}

function round1(v) {
  return Math.round(v * 10) / 10
}

/**
 * 単一の施策メモの「効果」を計測
 * レビューが測れればレビュー優先、なければトレンドをフォールバック
 */
export function measureActionEffect(note, { trendsData, reviewsData }) {
  if (!note?.eventType || !note.date) return null

  const reviewEffect = measureReviewEffect(reviewsData, note.app, note.date)
  if (reviewEffect) return reviewEffect

  const weekly = trendsData?.weekly
  const genres = trendsData?._genres
    || (weekly?.[0] ? Object.keys(weekly[0]).filter(k => k !== 'date') : [])
  const trendEffect = measureTrendEffect(weekly, genres, note.date, note.app)
  if (trendEffect) return trendEffect

  return null
}

// ─── 集計とランキング ────────────────────────────────────────

/**
 * 任意のキー関数で施策サンプルを集計
 * @param {object[]} samples - { note, effect } の配列
 * @param {(note) => string} keyFn - 集計キー抽出関数
 * @param {string} keyField - 集計結果オブジェクトでのキー名 (eventType, media, region, lane 等)
 */
function aggregateBy(samples, keyFn, keyField = 'eventType') {
  const map = {}
  for (const { note, effect } of samples) {
    const key = keyFn(note)
    if (key == null || key === '') continue
    if (!map[key]) {
      map[key] = {
        [keyField]: key,
        eventType: key, // 既存 UI 互換 (カード表示で参照)
        trials: 0,
        positive: 0,
        negative: 0,
        neutral: 0,
        rawDeltaSum: 0,
        netDeltaSum: 0,
        baselineDeltaSum: 0,
        baselineCount: 0,
        latestDate: note.date,
        samples: [],
      }
    }
    const a = map[key]
    a.trials++
    a[effect.verdict]++
    a.rawDeltaSum += effect.rawDelta
    a.netDeltaSum += effect.netDelta
    if (effect.baselineDelta != null) {
      a.baselineDeltaSum += effect.baselineDelta
      a.baselineCount++
    }
    if (note.date > a.latestDate) a.latestDate = note.date
    a.samples.push({
      date: note.date,
      event: note.event,
      app: note.app,
      metric: effect.metric,
      rawDelta: effect.rawDelta,
      baselineDelta: effect.baselineDelta,
      netDelta: effect.netDelta,
      deltaPct: effect.netDelta,
      verdict: effect.verdict,
      media: note.media || [],
      region: note.region || null,
      lane: note.lane || null,
      eventType: note.eventType,
    })
  }
  return Object.values(map).map(a => ({
    ...a,
    avgRawDelta: round1(a.rawDeltaSum / a.trials),
    avgNetDelta: round1(a.netDeltaSum / a.trials),
    avgBaselineDelta: a.baselineCount > 0 ? round1(a.baselineDeltaSum / a.baselineCount) : null,
    // 既存 API 互換: avgDelta は純効果
    avgDelta: round1(a.netDeltaSum / a.trials),
    positiveRate: Math.round((a.positive / a.trials) * 100),
    marketAdjusted: a.baselineCount > 0,
    samples: a.samples.sort((x, y) => y.date.localeCompare(x.date)),
  }))
}

const GROUP_BY_FNS = {
  eventType: (n) => n.eventType,
  media:     (n) => (n.media && n.media.length) ? n.media[0] : null,
  region:    (n) => n.region || null,
  lane:      (n) => n.lane || null,
}

function filterNotes(notes, filters) {
  if (!filters) return notes
  const { lane, media, region } = filters
  return notes.filter(n => {
    if (lane && (n.lane || 'product') !== lane) return false
    if (media && !(n.media || []).includes(media)) return false
    if (region && n.region !== region) return false
    return true
  })
}

/**
 * 信頼度スコア (0〜1)
 * 試行数の飽和 × 好影響率 × 効果量 (±20% で正規化) — 純効果ベース
 */
function confidenceScore(agg) {
  const sampleFactor = agg.trials / (agg.trials + 3)
  const rateFactor = Math.max(agg.positiveRate, 100 - agg.positiveRate) / 100
  const magnitudeFactor = Math.min(1, Math.abs(agg.avgNetDelta) / 20)
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
export function recommendActions({
  notes, trendsData, reviewsData,
  risks = [], opportunities = [],
  filters = null,       // { lane, media, region } — サンプルを事前絞り込み
  groupBy = 'eventType',// 'eventType' | 'media' | 'region' | 'lane'
}) {
  if (!Array.isArray(notes) || !notes.length) return []
  const filtered = filterNotes(notes.filter(n => n?.eventType), filters)
  if (!filtered.length) return []

  const samples = filtered
    .map(note => ({ note, effect: measureActionEffect(note, { trendsData, reviewsData }) }))
    .filter(x => x.effect)

  if (samples.length < MIN_TRIALS) return []

  const keyFn = GROUP_BY_FNS[groupBy] || GROUP_BY_FNS.eventType
  const aggregated = aggregateBy(samples, keyFn, groupBy)

  const hasRisk = (risks?.length || 0) > 0
  const hasOpp = (opportunities?.length || 0) > 0

  return aggregated
    .filter(a => a.trials >= MIN_TRIALS)
    .map(a => {
      const confidence = confidenceScore(a)
      const isProven = a.positiveRate >= 50 && a.avgNetDelta > NEUTRAL_THRESHOLD_PCT
      const isRisky  = a.positiveRate < 40 || a.avgNetDelta < -NEUTRAL_THRESHOLD_PCT

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
        groupKey: a[groupBy] ?? a.eventType,
        groupBy,
        trials: a.trials,
        positive: a.positive,
        negative: a.negative,
        neutral: a.neutral,
        positiveRate: a.positiveRate,
        avgRawDelta: a.avgRawDelta,
        avgNetDelta: a.avgNetDelta,
        avgBaselineDelta: a.avgBaselineDelta,
        marketAdjusted: a.marketAdjusted,
        // 既存 API 互換
        avgDelta: a.avgNetDelta,
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
export function countActionableSamples(notes, { trendsData, reviewsData, filters = null }) {
  const actionable = filterNotes((notes || []).filter(n => n?.eventType), filters)
  const measured = actionable.filter(n => measureActionEffect(n, { trendsData, reviewsData }))
  return { actionable: actionable.length, measured: measured.length }
}

/**
 * 記録済み施策から使われている媒体/地域/レーンのユニーク一覧を抽出 (UIフィルタ用)
 */
export function extractNoteFacets(notes) {
  const lanes = new Set()
  const medias = new Set()
  const regions = new Set()
  for (const n of notes || []) {
    if (!n?.eventType) continue
    if (n.lane) lanes.add(n.lane)
    if (Array.isArray(n.media)) for (const m of n.media) medias.add(m)
    if (n.region) regions.add(n.region)
  }
  return {
    lanes: [...lanes],
    medias: [...medias],
    regions: [...regions],
  }
}
