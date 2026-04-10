/**
 * ドメイン非依存の因果ログ自動蓄積エンジン
 *
 * 全ドメインで最も価値を生む中核コンポーネント。
 *
 * 処理フロー:
 *   1. 各レイヤーのデータから異常値・トレンド変動を検出
 *   2. ドメイン設定の季節パターンと照合
 *   3. 因果メモを自動生成
 *   4. 過去メモを実績と照合して自動検証
 *   5. 信頼度重みを更新（学習）
 *   6. パターンDBに蓄積
 *
 * 人間がやると継続できない記録を、AIが回し続ける。
 * 数ヶ月で膨大なパターンDBになる。
 */

import { detectAnomalies } from '../analyzers/anomaly.js'
import { movingAverage, periodOverPeriod } from '../analyzers/trend.js'

// ─── 学習パラメータ ──────────────────────────────────────────
const LEARNING_RATE_CONFIRM = 0.03
const LEARNING_RATE_REJECT = -0.05
const WEIGHT_MIN = -0.40
const WEIGHT_MAX = 0.35

/**
 * ドメイン非依存のパターン検出を実行
 *
 * @param {object} params
 * @param {object} params.domainConfig   - ドメイン設定
 * @param {object} params.timeSeriesData - { weekly: [{ date, [metric]: value }], _metrics: string[] }
 * @param {object[]} params.events       - イベントリスト
 * @param {object[]} params.existingMemos - 既存の因果メモ
 * @param {object} params.patternWeights - 学習済み重み
 * @returns {object[]} 新規因果メモ候補
 */
export function detectPatterns({
  domainConfig,
  timeSeriesData,
  events = [],
  existingMemos = [],
  patternWeights = {},
}) {
  const memos = []
  const analysisParams = {
    anomalyThreshold: 2.0,
    trendWindow: 4,
    causationWindowDays: 7,
    ...domainConfig.analysis,
  }

  const weekly = timeSeriesData?.weekly || []
  const metrics = timeSeriesData?._metrics || []

  if (weekly.length === 0) return memos

  // 1. 全メトリクスの異常値検出
  const allAnomalies = []
  for (const metric of metrics) {
    const values = weekly.map(w => w[metric] ?? 0)
    const anomalies = detectAnomalies(values, analysisParams.anomalyThreshold)
    for (const a of anomalies) {
      allAnomalies.push({
        metric,
        date: weekly[a.index]?.date,
        value: a.value,
        zscore: a.zscore,
        type: a.type,
      })
    }
  }

  // 2. トレンドシフト検出
  if (weekly.length >= analysisParams.trendWindow * 2) {
    for (const metric of metrics) {
      const values = weekly.map(w => w[metric] ?? 0)
      const w = analysisParams.trendWindow
      const recent = values.slice(-w)
      const prev = values.slice(-w * 2, -w)
      const recentAvg = recent.reduce((a, b) => a + b, 0) / w
      const prevAvg = prev.reduce((a, b) => a + b, 0) / w
      const change = prevAvg !== 0 ? ((recentAvg - prevAvg) / prevAvg) * 100 : 0

      if (Math.abs(change) >= 10) {
        const isUp = change > 0
        const rawScore = Math.min(Math.abs(change) / 100, 0.3)
        memos.push(buildMemo({
          domainConfig,
          date: weekly[weekly.length - 1].date,
          event: `${metric}トレンド${isUp ? '上昇' : '下降'}検出`,
          target: '全体',
          layer: 'macro',
          impact: isUp ? 'positive' : 'negative',
          memo: `${metric}の直近${w}期平均が前${w}期比で${change > 0 ? '+' : ''}${change.toFixed(1)}%変動`,
          patternType: 'trend_shift',
          rawScore,
          patternWeights,
          signals: [`trend_${isUp ? 'up' : 'down'}`, `change_${Math.abs(change).toFixed(0)}pct`],
          validation: { metric, predictedDirection: isUp ? 'up' : 'down', changePct: change },
        }))
      }
    }
  }

  // 3. 異常値×イベント相関
  if (analysisParams.causationWindowDays > 0) {
    for (const anomaly of allAnomalies) {
      for (const ev of events) {
        const diff = daysBetween(anomaly.date, ev.date || ev.start)
        if (diff <= analysisParams.causationWindowDays) {
          const proximity = 1 - diff / analysisParams.causationWindowDays
          const rawScore = proximity * 0.2
          memos.push(buildMemo({
            domainConfig,
            date: anomaly.date,
            event: `${ev.name || ev.event}付近で${anomaly.metric}に${anomaly.type === 'spike' ? '急上昇' : '急下降'}`,
            target: ev.target || ev.app || '全体',
            layer: 'causal',
            impact: anomaly.type === 'spike' ? 'positive' : 'negative',
            memo: `${anomaly.metric}のトレンド${anomaly.type} (z=${anomaly.zscore}) が「${ev.name || ev.event}」と±${analysisParams.causationWindowDays}日以内。近接度: ${(proximity * 100).toFixed(0)}%`,
            patternType: 'anomaly_event',
            rawScore,
            patternWeights,
            signals: [`anomaly_${anomaly.type}`, `proximity_${diff.toFixed(0)}d`],
            validation: { metric: anomaly.metric, anomalyType: anomaly.type, eventDate: ev.date || ev.start },
          }))
        }
      }
    }
  }

  // 4. 季節パターン
  const seasonalPatterns = domainConfig.seasonalPatterns || []
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  for (const pattern of seasonalPatterns) {
    if (pattern.month !== currentMonth) continue
    const isDuplicate = existingMemos.some(m =>
      m.event?.includes(pattern.event?.slice(0, 6)) &&
      m.date?.startsWith(now.getFullYear().toString())
    )
    if (isDuplicate) continue

    memos.push(buildMemo({
      domainConfig,
      date: `${now.getFullYear()}-${String(currentMonth).padStart(2, '0')}-01`,
      event: pattern.event,
      target: '全体',
      layer: pattern.layer,
      impact: pattern.impact,
      memo: `毎年${currentMonth}月に見られる季節的パターン`,
      patternType: 'seasonal',
      rawScore: 0.1,
      patternWeights,
      signals: [`month_${currentMonth}`, `seasonal_${pattern.impact}`],
      validation: { month: currentMonth, expectedImpact: pattern.impact },
    }))
  }

  // 重複排除
  return deduplicateMemos(memos, existingMemos)
}

/**
 * 過去メモを実績データと照合し、自動検証
 *
 * @param {object[]} memos - 検証対象の因果メモ
 * @param {object} currentData - 現在の実績データ
 * @param {object} domainConfig - ドメイン設定
 * @returns {{ confirmed: object[], rejected: object[], pending: object[] }}
 */
export function validateMemos(memos, currentData, domainConfig) {
  const params = {
    autoConfirmThreshold: 0.65,
    autoRejectThreshold: 0.30,
    ...domainConfig.analysis,
  }

  const confirmed = []
  const rejected = []
  const pending = []

  for (const memo of memos) {
    let result = null

    // トレンドシフトの検証: 予測方向と実績の一致
    if (memo.patternType === 'trend_shift' && memo._validation && currentData?.weekly?.length >= 4) {
      const { metric, predictedDirection } = memo._validation
      const w = currentData.weekly
      const last2 = w.slice(-2).map(r => r[metric] ?? 0)
      const prev2 = w.slice(-4, -2).map(r => r[metric] ?? 0)
      const l2Avg = last2.reduce((a, b) => a + b, 0) / 2
      const p2Avg = prev2.reduce((a, b) => a + b, 0) / 2
      const actualDir = l2Avg > p2Avg ? 'up' : 'down'
      result = actualDir === predictedDirection ? 'confirmed' : 'rejected'
    }

    // 信頼度ベースのフォールバック
    if (!result) {
      if (memo.confidence >= params.autoConfirmThreshold) result = 'auto_confirm'
      else if (memo.confidence < params.autoRejectThreshold) result = 'auto_reject'
    }

    if (result === 'confirmed' || result === 'auto_confirm') {
      confirmed.push({ ...memo, validationResult: result })
    } else if (result === 'rejected' || result === 'auto_reject') {
      rejected.push({ ...memo, validationResult: result })
    } else {
      pending.push(memo)
    }
  }

  return { confirmed, rejected, pending }
}

/**
 * 検証結果に基づき、パターン信頼度の重みを更新（学習）
 *
 * @param {object} patternWeights - 現在の重み
 * @param {object[]} confirmed - 承認されたメモ
 * @param {object[]} rejected - 却下されたメモ
 * @returns {object} 更新後の重み
 */
export function updateWeights(patternWeights, confirmed, rejected) {
  const weights = { ...patternWeights }

  for (const memo of confirmed) {
    const type = memo.patternType
    weights[type] = Math.min(WEIGHT_MAX, (weights[type] || 0) + LEARNING_RATE_CONFIRM)
  }

  for (const memo of rejected) {
    const type = memo.patternType
    weights[type] = Math.max(WEIGHT_MIN, (weights[type] || 0) + LEARNING_RATE_REJECT)
  }

  return weights
}

// ─── ヘルパー ──────────────────────────────────────────────────

function daysBetween(d1, d2) {
  return Math.abs(new Date(d1).getTime() - new Date(d2).getTime()) / (1000 * 60 * 60 * 24)
}

function makeId() {
  return `auto_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

function calcConfidence(patternType, rawScore, patternWeights, baseConfidences) {
  const defaults = {
    anomaly_event: 0.75,
    trend_shift: 0.60,
    review_spike: 0.70,
    news_correlation: 0.50,
    seasonal: 0.65,
  }
  const base = (baseConfidences || defaults)[patternType] || 0.5
  const learned = patternWeights[patternType] || 0
  return Math.max(0.05, Math.min(0.99, base + learned + rawScore))
}

function buildMemo({ domainConfig, date, event, target, layer, impact, memo, patternType, rawScore, patternWeights, signals, validation }) {
  return {
    id: makeId(),
    date,
    event,
    target,
    layer,
    impact,
    memo,
    auto: true,
    patternType,
    confidence: calcConfidence(patternType, rawScore, patternWeights),
    signals,
    domain: domainConfig.domain,
    _validation: validation,
  }
}

function deduplicateMemos(newMemos, existingMemos) {
  const seen = new Set()
  for (const m of existingMemos) {
    seen.add(`${m.date}_${m.patternType}_${m.target}`)
  }
  return newMemos.filter(m => {
    const key = `${m.date}_${m.patternType}_${m.target}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
