/**
 * 前回訪問時からの変化サマリーを算出する。
 *
 * 入力:
 *  - data: ダッシュボードに供給されている { reviews, fundamentals, trends, ranking, causation } など
 *  - lastVisitAt: 前回訪問時刻 (ISO 文字列) または null (= 初回訪問)
 *
 * 出力:
 *  {
 *    firstVisit: boolean,          // 初回訪問 (lastVisitAt が null)
 *    sinceDays: number|null,       // 前回訪問からの経過日数 (firstVisit=true なら null)
 *    sinceLabel: string|null,      // 「3日前」「12時間前」などの人間向けラベル
 *    changes: Array<Change>,       // 抽出された有意変化
 *  }
 *
 * Change = {
 *   key: string,                    // 安定キー (React key 用)
 *   type: 'review' | 'rank' | 'trend' | 'note' | 'twitter',
 *   severity: 'positive'|'negative'|'neutral'|'info',
 *   title: string,
 *   detail: string,
 * }
 *
 * すべての計算は既存の履歴データのみで完結し、追加の収集は発生しない。
 */

import { calcGenreTrends } from '../../analyzers/trend.js'

const REVIEW_SCORE_THRESHOLD = 0.2       // レビュースコア差
const RANK_THRESHOLD = 3                 // 順位の変動 (大きい=より大きな変化)
const TREND_POP_DELTA_THRESHOLD = 10     // pop4w 差 (パーセンテージポイント)
const MIN_QUIET_HOURS = 2                // この時間以内の再訪問では表示しない

function diffHours(later, earlier) {
  return (later.getTime() - earlier.getTime()) / (1000 * 60 * 60)
}

function formatSinceLabel(hours) {
  if (hours < 1) return '1時間未満前'
  if (hours < 24) return `${Math.round(hours)}時間前`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}日前`
  const weeks = Math.round(days / 7)
  if (weeks < 5) return `${weeks}週間前`
  const months = Math.round(days / 30)
  return `${months}ヶ月前`
}

/**
 * 配列から「指定時刻までに記録されたうち最新のエントリ」を取り出す。
 * 各エントリは `date` (YYYY-MM-DD) または `month` (YYYY-MM) を持つ想定。
 * 該当なしなら null。
 */
function findAtOrBefore(entries, cutoffIso, dateKey = 'date') {
  if (!entries?.length || !cutoffIso) return null
  const cutoff = new Date(cutoffIso).getTime()
  let candidate = null
  for (const e of entries) {
    const raw = e[dateKey]
    if (!raw) continue
    // YYYY-MM 形式は月初として解釈
    const iso = raw.length === 7 ? `${raw}-01` : raw
    const t = new Date(iso).getTime()
    if (Number.isNaN(t)) continue
    if (t <= cutoff && (!candidate || t > candidate._t)) {
      candidate = { ...e, _t: t }
    }
  }
  return candidate
}

function findTargetReview(reviews) {
  return reviews?.apps?.find(a => a.isMain || a.id === 'target') || null
}

function findTargetFundamental(fundamentals) {
  return fundamentals?.apps?.find(a => a.id === 'target') || null
}

function pushChange(list, change) {
  if (change) list.push(change)
}

/** レビュースコア変化 */
function detectReviewChange(reviews, lastVisitAt) {
  const target = findTargetReview(reviews)
  const monthly = target?.monthly || []
  if (monthly.length < 2) return null
  const latest = monthly[monthly.length - 1]
  const baseline = findAtOrBefore(monthly.slice(0, -1), lastVisitAt, 'month') || monthly[monthly.length - 2]
  if (!latest || !baseline || latest === baseline) return null
  const diff = (latest.score ?? 0) - (baseline.score ?? 0)
  if (Math.abs(diff) < REVIEW_SCORE_THRESHOLD) return null
  return {
    key: 'review-score',
    type: 'review',
    severity: diff >= 0 ? 'positive' : 'negative',
    title: `レビュースコア ★${latest.score} (${diff >= 0 ? '+' : ''}${diff.toFixed(1)})`,
    detail: `${baseline.month || '前回'} ★${baseline.score} → ${latest.month} ★${latest.score}`,
  }
}

/** セールスランキングの変化 (ranking.history があれば優先、なければ fundamentals のモック) */
function detectRankChange(ranking, fundamentals, lastVisitAt) {
  // 実データ: ranking.history[] の target 順位を比較
  if (ranking?.history?.length && ranking?.positions?.length) {
    const targetIds = ranking.positions.map(p => p.id)
    const latestHist = ranking.history[ranking.history.length - 1]
    const baseHist = findAtOrBefore(ranking.history.slice(0, -1), lastVisitAt, 'date')
    if (latestHist && baseHist) {
      // 対象アプリを含むポジションを抽出 (最初に見つかったもの)
      const pickRank = (hist) => {
        const pos = hist.positions?.find(p => targetIds.includes(p.id))
        return pos?.rank ?? null
      }
      const latest = pickRank(latestHist)
      const base = pickRank(baseHist)
      if (latest != null && base != null && latest !== base) {
        const diff = base - latest // 順位が上がる=数字が下がる → diff>0 で上昇
        if (Math.abs(diff) >= RANK_THRESHOLD) {
          return {
            key: 'rank-real',
            type: 'rank',
            severity: diff > 0 ? 'positive' : 'negative',
            title: `ランキング ${diff > 0 ? '▲' : '▼'}${Math.abs(diff)} (${latest}位)`,
            detail: `${baseHist.date} ${base}位 → ${latestHist.date} ${latest}位`,
          }
        }
      }
    }
  }

  // フォールバック: mock の weekly_sales_rank を使う
  const t = findTargetFundamental(fundamentals)
  const ranks = t?.weekly_sales_rank || []
  if (ranks.length < 2) return null
  const latest = ranks[ranks.length - 1]
  const base = findAtOrBefore(ranks.slice(0, -1), lastVisitAt, 'date') || ranks[ranks.length - 2]
  if (!latest || !base || latest === base) return null
  const diff = (base.rank ?? 0) - (latest.rank ?? 0)
  if (Math.abs(diff) < RANK_THRESHOLD) return null
  return {
    key: 'rank-mock',
    type: 'rank',
    severity: diff > 0 ? 'positive' : 'negative',
    title: `セールスランク ${diff > 0 ? '▲' : '▼'}${Math.abs(diff)} (${latest.rank}位)`,
    detail: `${base.date} ${base.rank}位 → ${latest.date} ${latest.rank}位`,
  }
}

/** ジャンルトレンドのシフト (現在と前回訪問時点で pop4w が有意に動いたもの) */
function detectTrendShifts(trends, lastVisitAt) {
  const weekly = trends?.weekly || []
  const genres = trends?._genres || Object.keys(weekly[0] || {}).filter(k => k !== 'date')
  if (weekly.length < 5 || !genres.length) return []

  const now = calcGenreTrends(weekly, genres)
  const cutoff = lastVisitAt ? new Date(lastVisitAt).getTime() : null
  // lastVisitAt 以前の週次データだけで再計算
  const pastSlice = cutoff
    ? weekly.filter(w => {
      const t = new Date(w.date).getTime()
      return !Number.isNaN(t) && t <= cutoff
    })
    : weekly.slice(0, -1)
  if (pastSlice.length < 5) return []
  const past = calcGenreTrends(pastSlice, genres)

  const shifts = []
  for (const genre of genres) {
    const a = parseFloat(now[genre]?.pop4w ?? 'NaN')
    const b = parseFloat(past[genre]?.pop4w ?? 'NaN')
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue
    const delta = a - b
    const flipped = now[genre].trend !== past[genre].trend &&
      (now[genre].trend === 'rising' || now[genre].trend === 'falling')
    if (Math.abs(delta) < TREND_POP_DELTA_THRESHOLD && !flipped) continue

    const severity = now[genre].trend === 'rising'
      ? 'positive'
      : now[genre].trend === 'falling'
        ? 'negative'
        : 'neutral'
    shifts.push({
      key: `trend-${genre}`,
      type: 'trend',
      severity,
      title: `${genre} ${a >= 0 ? '+' : ''}${a.toFixed(0)}% ${flipped ? '(転換)' : ''}`,
      detail: `前回訪問時 ${b.toFixed(0)}% → 現在 ${a.toFixed(0)}%`,
    })
  }
  // 大きい変動順に上位3件だけ
  shifts.sort((x, y) => Math.abs(parseFloat(y.title)) - Math.abs(parseFloat(x.title)))
  return shifts.slice(0, 3)
}

/** 前回訪問以降に追加された因果メモの件数 */
function detectNewNotes(causation, lastVisitAt) {
  const notes = causation?.notes || []
  if (!notes.length || !lastVisitAt) return null
  const cutoff = new Date(lastVisitAt).getTime()

  // createdAt があればそれで、なければ date (YYYY-MM-DD) をその日付の 0:00 として扱う
  const newer = notes.filter(n => {
    const iso = n.createdAt
      || (n.date ? (n.date.length === 7 ? `${n.date}-01` : n.date) : null)
    if (!iso) return false
    const t = new Date(iso).getTime()
    return Number.isFinite(t) && t > cutoff
  })
  if (!newer.length) return null

  const manual = newer.filter(n => n.source !== 'auto').length
  const auto = newer.length - manual
  const detail = [
    manual > 0 ? `手動 ${manual}件` : null,
    auto > 0 ? `自動 ${auto}件` : null,
  ].filter(Boolean).join(' / ')
  return {
    key: 'new-notes',
    type: 'note',
    severity: 'info',
    title: `新規因果メモ ${newer.length}件`,
    detail: detail || '前回訪問以降に蓄積',
  }
}

/** X (Twitter) 会話量の変化 */
function detectTwitterChange(twitter, lastVisitAt) {
  const hist = twitter?.history || []
  if (hist.length < 2) return null
  const latest = hist[hist.length - 1]
  const base = findAtOrBefore(hist.slice(0, -1), lastVisitAt, 'date') || hist[hist.length - 2]
  if (!latest || !base || latest === base) return null
  const a = latest.totalTweets ?? latest.tweetsPerDay ?? 0
  const b = base.totalTweets ?? base.tweetsPerDay ?? 0
  if (b === 0) return null
  const ratio = (a - b) / b
  if (Math.abs(ratio) < 0.3) return null // 30%未満の変動は無視
  return {
    key: 'twitter-volume',
    type: 'twitter',
    severity: ratio > 0 ? 'positive' : 'neutral',
    title: `X 会話量 ${ratio > 0 ? '+' : ''}${Math.round(ratio * 100)}%`,
    detail: `${base.date} ${b}件 → ${latest.date} ${a}件`,
  }
}

/**
 * メイン関数 — data と lastVisitAt から変化サマリーを返す。
 */
export function computeSinceLastVisit(data, lastVisitAt) {
  const now = new Date()
  const firstVisit = !lastVisitAt
  const sinceHours = firstVisit ? null : diffHours(now, new Date(lastVisitAt))

  // ごく直近に訪問した場合は非表示扱い (呼び出し側で分岐)
  const tooSoon = sinceHours != null && sinceHours < MIN_QUIET_HOURS

  const changes = []
  if (!firstVisit && !tooSoon && data) {
    pushChange(changes, detectReviewChange(data.reviews, lastVisitAt))
    pushChange(changes, detectRankChange(data.ranking, data.fundamentals, lastVisitAt))
    for (const shift of detectTrendShifts(data.trends, lastVisitAt)) pushChange(changes, shift)
    pushChange(changes, detectNewNotes(data.causation, lastVisitAt))
    pushChange(changes, detectTwitterChange(data.twitter, lastVisitAt))
  }

  return {
    firstVisit,
    tooSoon,
    sinceHours,
    sinceLabel: firstVisit ? null : formatSinceLabel(sinceHours),
    changes,
  }
}
