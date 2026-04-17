import { useState, useMemo, memo } from 'react'
import {
  LineChart, Line, ComposedChart, Bar,
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceDot, ReferenceLine, ReferenceArea, Cell,
} from 'recharts'
import { ChartTooltip, SentimentBar } from './shared/index.js'
import {
  PALETTE, TAG_COLORS, TYPE_COLORS,
  TREND_LABELS, TREND_ICONS, TREND_COLORS,
} from '../constants.js'
import { formatDate, isActive, getToday } from '../utils.js'
import { movingAverage, calcGenreTrends } from '../../analyzers/trend.js'
import { detectAllAnomalies } from '../../analyzers/anomaly.js'

const SECTION_TABS = [
  { key: 'reviewEvents', label: 'ターゲット' },
  { key: 'compReviewEvents', label: 'ベンチマーク比較' },
  { key: 'trends', label: 'トレンド' },
  { key: 'news', label: 'ニュース' },
  { key: 'twitter', label: 'X (会話量)' },
]

/**
 * 推移タブ — 時系列チャート + イベントオーバーレイ
 *
 * 過去からの変化を確認し、何が起きたかを振り返る
 */
export default memo(function HistoryView({
  target,
  reviews,
  fundamentals,
  trends,
  industry,
  events,
  ranking,
  community,
  twitter,
}) {
  const [section, setSection] = useState('reviewEvents')
  const today = getToday()

  // ─── Trends ───────────────────────────────────────
  const GENRES = trends?._genres || Object.keys(trends?.weekly?.[0] || {}).filter(k => k !== 'date')
  const GENRE_COLORS = useMemo(() =>
    Object.fromEntries(GENRES.map((g, i) => [g, PALETTE[i % PALETTE.length]])),
    [GENRES])

  const [activeGenres, setActiveGenres] = useState(() => new Set(GENRES))
  const [showMA, setShowMA] = useState(false)

  function toggleGenre(genre) {
    setActiveGenres(prev => {
      const next = new Set(prev)
      next.has(genre) ? next.delete(genre) : next.add(genre)
      return next
    })
  }

  const weeklyData = trends?.weekly || []

  const trendChartData = useMemo(() => {
    if (!weeklyData.length) return []
    const maData = {}
    for (const genre of GENRES) {
      const values = weeklyData.map(w => w[genre] ?? 0)
      maData[genre] = movingAverage(values, 4)
    }
    return weeklyData.map((row, i) => {
      const extended = { ...row }
      for (const genre of GENRES) {
        extended[`${genre}_MA`] = maData[genre][i]
      }
      return extended
    })
  }, [weeklyData, GENRES])

  const anomalies = useMemo(() => detectAllAnomalies(weeklyData, GENRES), [weeklyData, GENRES])
  const genreTrends = useMemo(() => calcGenreTrends(weeklyData, GENRES), [weeklyData, GENRES])

  // ─── Rankings (実データ) ────────────────────────────
  const realRankHistoryData = useMemo(() => {
    if (!ranking?.history?.length) return []
    return ranking.history.map(h => {
      const row = { date: h.date }
      for (const pos of h.positions) {
        row[pos.name] = pos.rank
      }
      return row
    })
  }, [ranking?.history])

  const realRankTargets = useMemo(() => {
    if (!ranking?.history?.length) return []
    const names = new Set()
    for (const h of ranking.history) {
      for (const pos of h.positions) names.add(pos.name)
    }
    return [...names]
  }, [ranking?.history])

  // ─── Rankings (モック) ─────────────────────────────
  const rankData = useMemo(() => {
    if (!fundamentals?.apps?.length) return []
    const dates = fundamentals.apps[0].weekly_sales_rank.map(d => d.date)
    return dates.map((date, i) => {
      const row = { date }
      for (const app of fundamentals.apps) {
        row[app.name] = app.weekly_sales_rank[i]?.rank
      }
      return row
    })
  }, [fundamentals?.apps])

  // ─── Reviews ──────────────────────────────────────
  const apps = reviews?.apps || []
  const mainApp = useMemo(() => apps.find(a => a.isMain || a.id === 'target'), [apps])
  const competitorApps = useMemo(() => apps.filter(a => !(a.isMain || a.id === 'target')), [apps])
  const REVIEW_COLORS = useMemo(() =>
    Object.fromEntries(apps.map((a, i) => [a.id, PALETTE[i % PALETTE.length]])),
    [apps])

  const [selectedReviewMonth, setSelectedReviewMonth] = useState(null)
  const [selectedCompMonth, setSelectedCompMonth] = useState(null)
  const [compView, setCompView] = useState('score')
  const [reviewView, setReviewView] = useState('score')
  const [selectedNewsWeek, setSelectedNewsWeek] = useState(null)
  const [selectedAppTag, setSelectedAppTag] = useState(null)

  const mainChartData = useMemo(() => {
    if (!mainApp) return []
    return mainApp.monthly.map(m => ({
      month: m.month.slice(5) + '月',
      スコア: m.score,
      レビュー数: m.count,
      好意的: Math.round(m.positive_ratio * 100),
    }))
  }, [mainApp])

  const compareData = useMemo(() => {
    if (!apps.length) return []
    const months = apps[0].monthly.map(m => m.month.slice(5) + '月')
    return months.map((month, i) => {
      const row = { month }
      for (const app of apps) {
        if (app.monthly[i]) row[app.name] = app.monthly[i].score
      }
      return row
    })
  }, [apps])

  const mainAccent = REVIEW_COLORS[mainApp?.id] || PALETTE[0]

  // ─── Main app monthly rank (reviewEvents ranking 切替用) ───
  const mainRankChartData = useMemo(() => {
    if (!mainApp) return []
    const byMonth = {}
    if (ranking?.history?.length) {
      for (const h of ranking.history) {
        const mk = h.date.slice(0, 7)
        const pos = h.positions.find(p => p.name === mainApp.name)
        if (pos) byMonth[mk] = pos.rank
      }
    } else if (fundamentals?.apps?.length) {
      const f = fundamentals.apps.find(fa => fa.name === mainApp.name || fa.id === mainApp.id)
      for (const w of f?.weekly_sales_rank || []) {
        byMonth[w.date.slice(0, 7)] = w.rank
      }
    }
    return mainApp.monthly.map(m => ({
      month: m.month.slice(5) + '月',
      monthKey: m.month,
      順位: byMonth[m.month] ?? null,
      レビュー数: m.count,
    }))
  }, [mainApp, ranking?.history, fundamentals?.apps])

  const mainRankHasData = useMemo(() =>
    mainRankChartData.some(d => d.順位 != null),
    [mainRankChartData])

  // ─── Competitor rank data (score/ranking 切替用) ───
  const hasRealRank = (ranking?.history?.length ?? 0) > 1
  const compRankChartData = hasRealRank ? realRankHistoryData : rankData
  const compRankTargets = hasRealRank
    ? realRankTargets
    : (fundamentals?.apps?.map(a => a.name) || [])

  const competitorRankSummary = useMemo(() => {
    if (hasRealRank) {
      const hist = ranking.history
      const last = hist[hist.length - 1]
      const prevIdx = Math.max(0, hist.length - 8)
      const prev = hist[prevIdx]
      return competitorApps.map(app => {
        const latest = last?.positions.find(p => p.name === app.name)?.rank
        const prevRank = prev?.positions.find(p => p.name === app.name)?.rank ?? latest
        const pos = (ranking.positions || []).find(p => p.name === app.name)
        if (latest == null) return null
        return {
          name: app.name,
          id: app.id,
          latest,
          diff: prevRank != null ? prevRank - latest : 0,
          collection: pos?.collection,
        }
      }).filter(Boolean)
    }
    return competitorApps.map(app => {
      const f = fundamentals?.apps?.find(fa => fa.name === app.name || fa.id === app.id)
      if (!f) return null
      const ranks = f.weekly_sales_rank || []
      const latest = ranks[ranks.length - 1]?.rank
      const prev = ranks[ranks.length - 5]?.rank ?? latest
      if (latest == null) return null
      return { name: app.name, id: app.id, latest, diff: prev - latest }
    }).filter(Boolean)
  }, [hasRealRank, ranking?.history, ranking?.positions, fundamentals?.apps, competitorApps])

  // ─── Reviews × Events helper ──────────────────────
  const mainAppEventsByMonth = useMemo(() => {
    const eventList = events?.events || []
    if (!mainApp || !eventList.length) return {}
    const byMonth = {}
    for (const e of eventList) {
      if (e.app !== mainApp.name) continue
      const monthKey = e.start.slice(5, 7) + '月'
      if (!byMonth[monthKey]) byMonth[monthKey] = []
      byMonth[monthKey].push(e)
    }
    return byMonth
  }, [mainApp, events])

  // ─── News ─────────────────────────────────────────
  const newsData = industry?.news || []

  // ─── News 時系列バケット (週単位) ─────────────────
  const newsTimeseries = useMemo(() => {
    const dated = newsData.filter(n => n.date)
    if (!dated.length) return []
    // 週頭 (月曜日) でバケット化
    const weekStartOf = (dateStr) => {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return null
      const day = d.getDay() // 0=日, 1=月, ..., 6=土
      const diff = (day + 6) % 7 // 月曜日までの差分
      d.setDate(d.getDate() - diff)
      return d.toISOString().slice(0, 10)
    }
    const buckets = {}
    for (const item of dated) {
      const wk = weekStartOf(item.date)
      if (!wk) continue
      if (!buckets[wk]) buckets[wk] = { week: wk, count: 0, items: [] }
      buckets[wk].count += 1
      buckets[wk].items.push(item)
    }
    const sorted = Object.values(buckets).sort((a, b) => a.week.localeCompare(b.week))
    return sorted.map(b => ({
      ...b,
      label: `${b.week.slice(5, 7)}/${b.week.slice(8, 10)}週`,
    }))
  }, [newsData])

  // ニュースに含まれるユニークなアプリタグを抽出
  const uniqueAppTags = useMemo(() => {
    const tags = new Set()
    for (const item of newsData) {
      if (item.appTags?.length) {
        for (const t of item.appTags) tags.add(t)
      }
    }
    return [...tags].sort()
  }, [newsData])

  // ─── Twitter/X timeseries ─────────────────────────
  // 履歴に日次データがある場合はそれを、無ければ stats.daily を使う
  const twitterDaily = useMemo(() => {
    if (twitter?.history?.length) {
      return twitter.history.map(h => ({
        date: h.date,
        label: `${h.date.slice(5, 7)}/${h.date.slice(8, 10)}`,
        totalTweets: h.stats?.totalTweets ?? 0,
        uniqueAuthors: h.stats?.uniqueAuthors ?? 0,
      }))
    }
    if (twitter?.stats?.daily?.length) {
      return twitter.stats.daily.map(d => ({
        date: d.date,
        label: `${d.date.slice(5, 7)}/${d.date.slice(8, 10)}`,
        totalTweets: d.count,
        uniqueAuthors: null,
      }))
    }
    return []
  }, [twitter])

  const filteredNews = useMemo(() => {
    let items = newsData
    if (selectedNewsWeek) {
      const bucket = newsTimeseries.find(b => b.week === selectedNewsWeek)
      items = bucket?.items || []
    }
    if (selectedAppTag) {
      items = items.filter(n => n.appTags?.includes(selectedAppTag))
    }
    return items
  }, [newsData, newsTimeseries, selectedNewsWeek, selectedAppTag])

  return (
    <>
      {/* ━━━ メインパネル ━━━ */}
      <div className="panel" style={{ gridColumn: '1 / -1' }}>
        <div className="panel-header">
          <div className="panel-header-left">
            <div className="panel-indicator history-indicator" />
            <span className="panel-title history-title">推移</span>
            <span className="panel-tag">時系列データ</span>
          </div>
        </div>
        <div className="panel-body">
          {/* ──── 自アプリ最新スナップショット (タブ切替でも固定表示) ──── */}
          {mainApp && (() => {
            const monthly = mainApp.monthly || []
            const latest = monthly[monthly.length - 1]
            const prev = monthly[monthly.length - 2]
            const scoreDiff = latest && prev ? +(latest.score - prev.score).toFixed(1) : null
            const ranksFilled = mainRankChartData.filter(d => d.順位 != null)
            const latestRank = ranksFilled[ranksFilled.length - 1]?.順位 ?? null
            const prevRank = ranksFilled[ranksFilled.length - 2]?.順位 ?? null
            const rankDiff = latestRank != null && prevRank != null ? prevRank - latestRank : null

            return (
              <div style={{ padding: '8px 10px', borderRadius: 6, background: `${mainAccent}12`, border: `1px solid ${mainAccent}44`, marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: mainAccent }}>{mainApp.name}</span>
                  <span style={{ fontSize: 9, fontWeight: 600, color: '#8b949e', padding: '1px 6px', borderRadius: 3, background: '#21262d' }}>最新</span>
                  {latest && (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <span style={{ fontSize: 9, color: '#6e7681' }}>スコア</span>
                      <span style={{ fontSize: 16, fontWeight: 700, color: '#e6edf3' }}>★{latest.score}</span>
                      {scoreDiff !== null && (
                        <span style={{ fontSize: 10, fontWeight: 600, color: scoreDiff >= 0 ? '#56d364' : '#f85149' }}>
                          {scoreDiff >= 0 ? '▲' : '▼'}{Math.abs(scoreDiff)}
                        </span>
                      )}
                    </div>
                  )}
                  {latestRank != null && (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <span style={{ fontSize: 9, color: '#6e7681' }}>順位</span>
                      <span style={{ fontSize: 16, fontWeight: 700, color: '#e6edf3' }}>{latestRank}位</span>
                      {rankDiff !== null && (
                        <span style={{ fontSize: 10, fontWeight: 600, color: rankDiff > 0 ? '#56d364' : rankDiff < 0 ? '#f85149' : '#6e7681' }}>
                          {rankDiff > 0 ? `▲${rankDiff}` : rankDiff < 0 ? `▼${Math.abs(rankDiff)}` : '→'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })()}

          <div className="fundamental-tabs">
            {SECTION_TABS.map(t => (
              <button key={t.key} className={`fundamental-tab history-tab ${section === t.key ? 'active' : ''}`} onClick={() => setSection(t.key)}>{t.label}</button>
            ))}
          </div>

          {/* ──── トレンド ──── */}
          {section === 'trends' && weeklyData.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div className="genre-legend" style={{ flex: 1, marginBottom: 0 }}>
                  {GENRES.map(genre => (
                    <button key={genre} className="legend-item" onClick={() => toggleGenre(genre)} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: activeGenres.has(genre) ? 1 : 0.35, padding: '2px 4px', borderRadius: 4 }}>
                      <span className="legend-dot" style={{ background: GENRE_COLORS[genre] }} />
                      <span style={{ color: activeGenres.has(genre) ? '#e6edf3' : '#6e7681', fontSize: 11 }}>{genre}</span>
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button onClick={() => setShowMA(v => !v)} className="macro-toggle-btn" style={{ borderColor: showMA ? 'rgba(56,139,253,0.5)' : '#30363d', background: showMA ? 'rgba(56,139,253,0.15)' : 'transparent', color: showMA ? '#388bfd' : '#6e7681' }}>MA4</button>
                  <span style={{ fontSize: 9, color: '#6e7681' }}>Google Trends</span>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trendChartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                  <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={{ stroke: '#30363d' }} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  {GENRES.map(genre => activeGenres.has(genre) && (
                    <Line key={genre} type="monotone" dataKey={genre} stroke={GENRE_COLORS[genre]} strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
                  ))}
                  {showMA && GENRES.map(genre => activeGenres.has(genre) && (
                    <Line key={`${genre}_MA`} type="monotone" dataKey={`${genre}_MA`} name={`${genre} MA4`} stroke={GENRE_COLORS[genre]} strokeWidth={1} strokeDasharray="4 3" dot={false} connectNulls />
                  ))}
                  {anomalies.filter(a => activeGenres.has(a.genre)).map((a, i) => (
                    <ReferenceDot key={`anomaly-${i}`} x={a.date} y={a.value} r={a.severity === 'high' ? 5 : 4} fill={a.type === 'spike' ? '#56d364' : '#f85149'} stroke={a.type === 'spike' ? '#56d364' : '#f85149'} fillOpacity={0.6} strokeWidth={1.5} />
                  ))}
                </LineChart>
              </ResponsiveContainer>

              <div className="trend-badges">
                {GENRES.map(genre => {
                  const t = genreTrends[genre]
                  if (!t) return null
                  return (
                    <span key={genre} className="trend-badge" style={{ borderColor: `${GENRE_COLORS[genre]}44`, background: `${GENRE_COLORS[genre]}11` }}>
                      <span style={{ color: GENRE_COLORS[genre], fontWeight: 600 }}>{genre}</span>
                      <span style={{ color: TREND_COLORS[t.trend], fontSize: 10 }}>{TREND_ICONS[t.trend]} {TREND_LABELS[t.trend]}</span>
                      <span style={{ color: '#6e7681', fontSize: 10 }}>({t.pop4w > 0 ? '+' : ''}{t.pop4w}%)</span>
                    </span>
                  )
                })}
              </div>

              {anomalies.length > 0 && (
                <div style={{ marginTop: 8, fontSize: 10, color: '#f85149' }}>
                  異常検知: {anomalies.length}件
                </div>
              )}
            </>
          )}

          {/* ──── ターゲット (自社) ──── */}
          {section === 'reviewEvents' && (
            <>
              {mainApp ? (() => {
                const eventMonths = Object.keys(mainAppEventsByMonth)
                const chartMonthSet = new Set(mainChartData.map(d => d.month))
                const extraMonths = eventMonths.filter(m => !chartMonthSet.has(m)).sort()
                const showRanking = reviewView === 'ranking' && mainRankHasData

                return (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 10, color: '#6e7681' }}>
                        {showRanking ? '順位推移 (低い=上位)' : 'スコア推移'}
                      </span>
                      {selectedReviewMonth && (
                        <span style={{ fontSize: 10, fontWeight: 600, color: '#8b949e', padding: '1px 6px', borderRadius: 3, background: '#21262d' }}>{selectedReviewMonth}</span>
                      )}
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                        <button
                          onClick={() => setReviewView('score')}
                          className="macro-toggle-btn"
                          style={{
                            borderColor: reviewView === 'score' ? 'rgba(56,139,253,0.5)' : '#30363d',
                            background: reviewView === 'score' ? 'rgba(56,139,253,0.15)' : 'transparent',
                            color: reviewView === 'score' ? '#388bfd' : '#6e7681',
                          }}
                        >スコア</button>
                        <button
                          onClick={() => setReviewView('ranking')}
                          disabled={!mainRankHasData}
                          className="macro-toggle-btn"
                          style={{
                            borderColor: reviewView === 'ranking' ? 'rgba(56,139,253,0.5)' : '#30363d',
                            background: reviewView === 'ranking' ? 'rgba(56,139,253,0.15)' : 'transparent',
                            color: reviewView === 'ranking' ? '#388bfd' : '#6e7681',
                            opacity: mainRankHasData ? 1 : 0.4,
                            cursor: mainRankHasData ? 'pointer' : 'not-allowed',
                          }}
                        >ランキング</button>
                      </div>
                    </div>

                    <ResponsiveContainer width="100%" height={200}>
                      <ComposedChart data={showRanking ? mainRankChartData : mainChartData} margin={{ top: 16, right: 8, bottom: 0, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={{ stroke: '#30363d' }} tickLine={false} />
                        {showRanking ? (
                          <YAxis yAxisId="left" reversed domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={false} tickLine={false} />
                        ) : (
                          <YAxis yAxisId="left" domain={[0, 5]} tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={false} tickLine={false} />
                        )}
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar yAxisId="right" dataKey="レビュー数" cursor="pointer" onClick={(data) => setSelectedReviewMonth(prev => prev === data?.month ? null : data?.month)}>
                          {(showRanking ? mainRankChartData : mainChartData).map((entry, idx) => (
                            <Cell key={idx} fill={entry.month === selectedReviewMonth ? `${mainAccent}66` : `${mainAccent}33`} stroke={entry.month === selectedReviewMonth ? mainAccent : `${mainAccent}66`} strokeWidth={entry.month === selectedReviewMonth ? 2 : 1} />
                          ))}
                        </Bar>
                        {showRanking ? (
                          <Line yAxisId="left" type="monotone" dataKey="順位" stroke={mainAccent} strokeWidth={2} dot={{ fill: mainAccent, r: 3 }} activeDot={{ r: 4 }} connectNulls />
                        ) : (
                          <Line yAxisId="left" type="monotone" dataKey="スコア" stroke={mainAccent} strokeWidth={2} dot={{ fill: mainAccent, r: 3 }} activeDot={{ r: 4 }} />
                        )}
                        {eventMonths.filter(m => chartMonthSet.has(m)).map(month => (
                          <ReferenceLine
                            key={`ev-${month}`}
                            x={month}
                            yAxisId="left"
                            stroke={TYPE_COLORS[mainAppEventsByMonth[month][0]?.type] || '#8b949e'}
                            strokeDasharray="4 3"
                            strokeWidth={1.5}
                            label={{ value: mainAppEventsByMonth[month][0]?.type || '', position: 'top', fill: TYPE_COLORS[mainAppEventsByMonth[month][0]?.type] || '#8b949e', fontSize: 9 }}
                          />
                        ))}
                      </ComposedChart>
                    </ResponsiveContainer>

                    {/* Selected month detail panel */}
                    {selectedReviewMonth && (() => {
                      const monthData = mainApp.monthly.find(m => m.month.slice(5) + '月' === selectedReviewMonth)
                      if (!monthData) return null
                      const monthEvents = mainAppEventsByMonth[selectedReviewMonth] || []
                      const prevIdx = mainApp.monthly.indexOf(monthData) - 1
                      const prevData = prevIdx >= 0 ? mainApp.monthly[prevIdx] : null
                      const scoreDiff = prevData ? (monthData.score - prevData.score).toFixed(1) : null
                      const rankRow = mainRankChartData.find(d => d.month === selectedReviewMonth)
                      const prevRankRow = rankRow ? [...mainRankChartData.slice(0, mainRankChartData.indexOf(rankRow))].reverse().find(d => d.順位 != null) : null
                      const rowRankDiff = rankRow?.順位 != null && prevRankRow?.順位 != null ? prevRankRow.順位 - rankRow.順位 : null
                      return (
                        <div style={{ margin: '8px 0', padding: '8px 10px', borderRadius: 6, border: `1px solid ${mainAccent}44`, background: `${mainAccent}08` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: mainAccent }}>{selectedReviewMonth}</span>
                            {showRanking ? (
                              <>
                                <span style={{ fontSize: 16, fontWeight: 700, color: '#e6edf3' }}>{rankRow?.順位 != null ? `${rankRow.順位}位` : '—'}</span>
                                {rowRankDiff !== null && (
                                  <span style={{ fontSize: 10, fontWeight: 600, color: rowRankDiff > 0 ? '#56d364' : rowRankDiff < 0 ? '#f85149' : '#6e7681' }}>
                                    {rowRankDiff > 0 ? `▲${rowRankDiff}` : rowRankDiff < 0 ? `▼${Math.abs(rowRankDiff)}` : '→'}
                                  </span>
                                )}
                              </>
                            ) : (
                              <>
                                <span style={{ fontSize: 16, fontWeight: 700, color: '#e6edf3' }}>★{monthData.score}</span>
                                {scoreDiff !== null && (
                                  <span style={{ fontSize: 10, fontWeight: 600, color: parseFloat(scoreDiff) >= 0 ? '#56d364' : '#f85149' }}>
                                    {parseFloat(scoreDiff) >= 0 ? '▲' : '▼'}{Math.abs(parseFloat(scoreDiff))}
                                  </span>
                                )}
                              </>
                            )}
                            <span style={{ fontSize: 10, color: '#6e7681' }}>{monthData.count.toLocaleString()}件</span>
                            <span style={{ marginLeft: 'auto', fontSize: 9, color: '#484f58', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setSelectedReviewMonth(null) }}>✕ 閉じる</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: monthEvents.length ? 8 : 0 }}>
                            <span style={{ fontSize: 9, color: '#6e7681', whiteSpace: 'nowrap' }}>好意度</span>
                            <div style={{ flex: 1 }}><SentimentBar ratio={monthData.positive_ratio} color={mainAccent} /></div>
                            <span style={{ fontSize: 10, fontWeight: 600, color: '#e6edf3' }}>{Math.round(monthData.positive_ratio * 100)}%</span>
                          </div>
                          {monthEvents.length > 0 && (
                            <div style={{ borderTop: '1px solid #21262d', paddingTop: 6 }}>
                              <div style={{ fontSize: 9, color: '#8b949e', marginBottom: 4 }}>この月のイベント</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {monthEvents.map((e, i) => (
                                  <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 6px', borderRadius: 4, background: `${TYPE_COLORS[e.type] || '#8b949e'}15`, border: `1px solid ${TYPE_COLORS[e.type] || '#8b949e'}33` }}>
                                    <span style={{ fontSize: 9, fontWeight: 600, color: TYPE_COLORS[e.type] || '#8b949e' }}>{e.type}</span>
                                    <span style={{ fontSize: 9, color: '#e6edf3' }}>{e.name}</span>
                                    {isActive(e, today) && <span style={{ fontSize: 8, padding: '0 3px', borderRadius: 2, background: 'rgba(86,211,100,0.15)', color: '#56d364' }}>開催中</span>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })()}

                    {!selectedReviewMonth && <div style={{ fontSize: 9, color: '#484f58', textAlign: 'center', marginTop: 4 }}>棒グラフをタップで月別詳細を表示</div>}

                    {/* Event detail strip */}
                    {eventMonths.length > 0 && (
                      <div style={{ marginTop: 6 }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: '#8b949e', marginBottom: 4 }}>関連イベント</div>
                        {mainChartData.map(d => {
                          const evts = mainAppEventsByMonth[d.month]
                          if (!evts?.length) return null
                          return (
                            <div key={d.month} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 0', borderBottom: '1px solid #21262d' }}>
                              <span style={{ fontSize: 10, color: '#6e7681', minWidth: 32, fontFamily: 'monospace', fontWeight: 600 }}>{d.month}</span>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, flex: 1 }}>
                                {evts.map((e, i) => (
                                  <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 6px', borderRadius: 4, background: `${TYPE_COLORS[e.type] || '#8b949e'}15`, border: `1px solid ${TYPE_COLORS[e.type] || '#8b949e'}33` }}>
                                    <span style={{ fontSize: 9, fontWeight: 600, color: TYPE_COLORS[e.type] || '#8b949e' }}>{e.type}</span>
                                    <span style={{ fontSize: 9, color: '#e6edf3' }}>{e.name}</span>
                                    {isActive(e, today) && <span style={{ fontSize: 8, padding: '0 3px', borderRadius: 2, background: 'rgba(86,211,100,0.15)', color: '#56d364' }}>開催中</span>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                        {extraMonths.map(month => (
                          <div key={month} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 0', borderBottom: '1px solid #21262d', opacity: 0.7 }}>
                            <span style={{ fontSize: 10, color: '#484f58', minWidth: 32, fontFamily: 'monospace', fontWeight: 600 }}>{month}</span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, flex: 1 }}>
                              {mainAppEventsByMonth[month].map((e, i) => (
                                <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 6px', borderRadius: 4, background: `${TYPE_COLORS[e.type] || '#8b949e'}15`, border: `1px solid ${TYPE_COLORS[e.type] || '#8b949e'}33` }}>
                                  <span style={{ fontSize: 9, fontWeight: 600, color: TYPE_COLORS[e.type] || '#8b949e' }}>{e.type}</span>
                                  <span style={{ fontSize: 9, color: '#e6edf3' }}>{e.name}</span>
                                  {isActive(e, today) && <span style={{ fontSize: 8, padding: '0 3px', borderRadius: 2, background: 'rgba(86,211,100,0.15)', color: '#56d364' }}>開催中</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {eventMonths.length === 0 && (
                      <div style={{ marginTop: 8, fontSize: 10, color: '#484f58', textAlign: 'center', padding: 8 }}>
                        この期間のイベントデータはありません
                      </div>
                    )}
                  </>
                )
              })() : (
                <div style={{ fontSize: 10, color: '#484f58', textAlign: 'center', padding: 20 }}>
                  レビューデータがありません
                </div>
              )}
            </>
          )}

          {/* ──── ベンチマーク比較 ──── */}
          {section === 'compReviewEvents' && (
            <>
              {competitorApps.length > 0 ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <div style={{ fontSize: 10, color: '#6e7681' }}>
                      {compView === 'score' ? '競合スコア推移' : '競合順位推移 (低い=上位)'}
                    </div>
                    {selectedCompMonth && (
                      <span style={{ fontSize: 10, fontWeight: 600, color: '#8b949e', padding: '1px 6px', borderRadius: 3, background: '#21262d' }}>{selectedCompMonth}</span>
                    )}
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                      <button
                        onClick={() => setCompView('score')}
                        className="macro-toggle-btn"
                        style={{
                          borderColor: compView === 'score' ? 'rgba(56,139,253,0.5)' : '#30363d',
                          background: compView === 'score' ? 'rgba(56,139,253,0.15)' : 'transparent',
                          color: compView === 'score' ? '#388bfd' : '#6e7681',
                        }}
                      >スコア</button>
                      <button
                        onClick={() => setCompView('ranking')}
                        disabled={!mainRankHasData}
                        className="macro-toggle-btn"
                        style={{
                          borderColor: compView === 'ranking' ? 'rgba(56,139,253,0.5)' : '#30363d',
                          background: compView === 'ranking' ? 'rgba(56,139,253,0.15)' : 'transparent',
                          color: compView === 'ranking' ? '#388bfd' : '#6e7681',
                          opacity: mainRankHasData ? 1 : 0.4,
                          cursor: mainRankHasData ? 'pointer' : 'not-allowed',
                        }}
                      >ランキング</button>
                    </div>
                  </div>

                  {compView === 'score' ? (
                    <>
                      <ResponsiveContainer width="100%" height={180}>
                        <LineChart
                          data={compareData}
                          margin={{ top: 4, right: 8, bottom: 0, left: -20 }}
                          onClick={(data) => { if (data?.activeLabel) setSelectedCompMonth(prev => prev === data.activeLabel ? null : data.activeLabel) }}
                          style={{ cursor: 'pointer' }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                          <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={{ stroke: '#30363d' }} tickLine={false} />
                          <YAxis domain={[3, 5]} tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={false} tickLine={false} />
                          <Tooltip content={<ChartTooltip />} />
                          {apps.map(app => (
                            <Line key={app.id} type="monotone" dataKey={app.name} stroke={REVIEW_COLORS[app.id]} strokeWidth={app.isMain || app.id === 'target' ? 2.5 : 1.5} strokeDasharray={app.isMain || app.id === 'target' ? undefined : '4 3'} dot={{ fill: REVIEW_COLORS[app.id], r: 2 }} />
                          ))}
                          {selectedCompMonth && (
                            <ReferenceLine x={selectedCompMonth} stroke="#e6edf3" strokeWidth={1.5} />
                          )}
                        </LineChart>
                      </ResponsiveContainer>

                      {selectedCompMonth ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#e6edf3' }}>{selectedCompMonth}</span>
                          <span style={{ fontSize: 9, color: '#484f58', cursor: 'pointer' }} onClick={() => setSelectedCompMonth(null)}>✕ 解除</span>
                        </div>
                      ) : (
                        <div style={{ fontSize: 9, color: '#484f58', textAlign: 'center', marginTop: 4 }}>チャートをタップで月別データを表示</div>
                      )}

                      {/* Competitor list — month-specific or latest (score) */}
                      <div style={{ marginTop: 6 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          {competitorApps.map(app => {
                            const monthIdx = selectedCompMonth
                              ? app.monthly.findIndex(m => m.month.slice(5) + '月' === selectedCompMonth)
                              : app.monthly.length - 1
                            const monthData = monthIdx >= 0 ? app.monthly[monthIdx] : null
                            const prevData = monthIdx > 0 ? app.monthly[monthIdx - 1] : null
                            const diff = prevData && monthData ? (monthData.score - prevData.score).toFixed(1) : '0.0'
                            if (!monthData) return null
                            return (
                              <div key={app.id} style={{ padding: '5px 8px', borderBottom: '1px solid #21262d' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ fontSize: 10, fontWeight: 600, color: REVIEW_COLORS[app.id], minWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.name}</span>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: '#e6edf3' }}>★{monthData.score}</span>
                                  <span style={{ fontSize: 9, color: parseFloat(diff) >= 0 ? '#56d364' : '#f85149' }}>
                                    {parseFloat(diff) >= 0 ? '▲' : '▼'}{Math.abs(diff)}
                                  </span>
                                  <span style={{ fontSize: 9, color: '#6e7681' }}>{monthData.count.toLocaleString()}件</span>
                                  <div style={{ flex: 1 }}>
                                    <SentimentBar ratio={monthData.positive_ratio ?? 0} color={REVIEW_COLORS[app.id]} />
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {compRankChartData.length > 0 && competitorRankSummary.length > 0 ? (() => {
                        // 選択月に該当する範囲を抽出 (ReferenceArea / リスト両用)
                        const monthIdxs = selectedCompMonth
                          ? compRankChartData.reduce((acc, d, i) => {
                              if (d.date.slice(5, 7) + '月' === selectedCompMonth) acc.push(i)
                              return acc
                            }, [])
                          : []
                        const selFirstDate = monthIdxs.length ? compRankChartData[monthIdxs[0]].date : null
                        const selLastDate = monthIdxs.length ? compRankChartData[monthIdxs[monthIdxs.length - 1]].date : null
                        const selLastIdx = monthIdxs.length ? monthIdxs[monthIdxs.length - 1] : -1
                        // 前月最終日 (差分計算用) — 選択月の先頭の直前
                        const prevIdx = monthIdxs.length && monthIdxs[0] > 0 ? monthIdxs[0] - 1 : -1
                        return (
                          <>
                            <ResponsiveContainer width="100%" height={180}>
                              <LineChart
                                data={compRankChartData}
                                margin={{ top: 4, right: 8, bottom: 0, left: -20 }}
                                onClick={(data) => {
                                  if (data?.activeLabel) {
                                    const m = String(data.activeLabel).slice(5, 7) + '月'
                                    setSelectedCompMonth(prev => prev === m ? null : m)
                                  }
                                }}
                                style={{ cursor: 'pointer' }}
                              >
                                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                                <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={{ stroke: '#30363d' }} tickLine={false} />
                                <YAxis reversed domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={false} tickLine={false} />
                                <Tooltip content={<ChartTooltip />} />
                                {selFirstDate && selLastDate && (
                                  <ReferenceArea x1={selFirstDate} x2={selLastDate} fill="#e6edf3" fillOpacity={0.08} stroke="#e6edf3" strokeOpacity={0.3} />
                                )}
                                {compRankTargets.map(name => {
                                  const app = apps.find(a => a.name === name)
                                  const color = app ? REVIEW_COLORS[app.id] : PALETTE[compRankTargets.indexOf(name) % PALETTE.length]
                                  const isMain = app && (app.isMain || app.id === 'target')
                                  return (
                                    <Line
                                      key={name}
                                      type="monotone"
                                      dataKey={name}
                                      stroke={color}
                                      strokeWidth={isMain ? 2.5 : 1.5}
                                      strokeDasharray={isMain ? undefined : '4 3'}
                                      dot={{ r: 2 }}
                                      connectNulls
                                    />
                                  )
                                })}
                              </LineChart>
                            </ResponsiveContainer>

                            {selectedCompMonth ? (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#e6edf3' }}>{selectedCompMonth}</span>
                                <span style={{ fontSize: 9, color: '#484f58', cursor: 'pointer' }} onClick={() => setSelectedCompMonth(null)}>✕ 解除</span>
                              </div>
                            ) : (
                              <div style={{ fontSize: 9, color: '#484f58', textAlign: 'center', marginTop: 4 }}>チャートをタップで月別データを表示</div>
                            )}

                            {/* Competitor list — month-specific or latest (rank) */}
                            <div style={{ marginTop: 6 }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                {competitorRankSummary.map(app => {
                                  let rank = app.latest
                                  let diff = app.diff
                                  if (selLastIdx >= 0) {
                                    const r = compRankChartData[selLastIdx]?.[app.name]
                                    const p = prevIdx >= 0 ? compRankChartData[prevIdx]?.[app.name] : null
                                    if (r != null) {
                                      rank = r
                                      diff = p != null ? p - r : 0
                                    }
                                  }
                                  return (
                                    <div key={app.id} style={{ padding: '5px 8px', borderBottom: '1px solid #21262d' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{ fontSize: 10, fontWeight: 600, color: REVIEW_COLORS[app.id] || '#6e7681', minWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.name}</span>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: '#e6edf3' }}>{rank != null ? `${rank}位` : '—'}</span>
                                        <span style={{ fontSize: 9, color: diff > 0 ? '#56d364' : diff < 0 ? '#f85149' : '#6e7681' }}>
                                          {diff > 0 ? `▲${diff}` : diff < 0 ? `▼${Math.abs(diff)}` : '→'}
                                        </span>
                                        {app.collection && (
                                          <span style={{ fontSize: 9, color: '#6e7681' }}>{app.collection === 'top_grossing' ? '売上' : '無料'}</span>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          </>
                        )
                      })() : (
                        <div style={{ fontSize: 10, color: '#484f58', textAlign: 'center', padding: 20 }}>
                          ランキングデータがありません
                        </div>
                      )}
                    </>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 10, color: '#484f58', textAlign: 'center', padding: 20 }}>
                  競合データがありません
                </div>
              )}
            </>
          )}

          {/* ──── ニュース ──── */}
          {section === 'news' && newsData.length > 0 && (
            <>
              {newsTimeseries.length > 0 && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 10, color: '#6e7681' }}>週次ニュース件数</span>
                    {selectedNewsWeek && (
                      <>
                        <span style={{ fontSize: 10, fontWeight: 600, color: '#8b949e', padding: '1px 6px', borderRadius: 3, background: '#21262d' }}>
                          {newsTimeseries.find(b => b.week === selectedNewsWeek)?.label || selectedNewsWeek}
                        </span>
                        <button
                          onClick={() => setSelectedNewsWeek(null)}
                          className="macro-toggle-btn"
                          style={{ borderColor: '#30363d', background: 'transparent', color: '#6e7681' }}
                        >クリア</button>
                      </>
                    )}
                    <span style={{ marginLeft: 'auto', fontSize: 9, color: '#6e7681' }}>
                      全{newsData.length}件 / 表示{filteredNews.length}件
                    </span>
                  </div>
                  <ResponsiveContainer width="100%" height={140}>
                    <ComposedChart data={newsTimeseries} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={{ stroke: '#30363d' }} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar
                        dataKey="count"
                        name="件数"
                        cursor="pointer"
                        onClick={(data) => setSelectedNewsWeek(prev => prev === data?.week ? null : data?.week)}
                      >
                        {newsTimeseries.map((entry, idx) => (
                          <Cell
                            key={idx}
                            fill={entry.week === selectedNewsWeek ? '#388bfd' : '#388bfd66'}
                            stroke={entry.week === selectedNewsWeek ? '#58a6ff' : '#388bfd99'}
                            strokeWidth={entry.week === selectedNewsWeek ? 2 : 1}
                          />
                        ))}
                      </Bar>
                    </ComposedChart>
                  </ResponsiveContainer>
                  {!selectedNewsWeek && (
                    <div style={{ fontSize: 9, color: '#484f58', textAlign: 'center', marginTop: 2, marginBottom: 6 }}>
                      棒グラフをタップでその週のニュースに絞り込み
                    </div>
                  )}
                </>
              )}

              {/* アプリ別フィルタ */}
              {uniqueAppTags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: '#6e7681', lineHeight: '20px' }}>アプリ:</span>
                  {uniqueAppTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => setSelectedAppTag(prev => prev === tag ? null : tag)}
                      className="macro-toggle-btn"
                      style={{
                        borderColor: selectedAppTag === tag ? '#d2a8ff' : '#30363d',
                        background: selectedAppTag === tag ? '#d2a8ff18' : 'transparent',
                        color: selectedAppTag === tag ? '#d2a8ff' : '#8b949e',
                        fontSize: 10,
                        padding: '1px 8px',
                      }}
                    >{tag}</button>
                  ))}
                  {selectedAppTag && (
                    <button
                      onClick={() => setSelectedAppTag(null)}
                      className="macro-toggle-btn"
                      style={{ borderColor: '#30363d', background: 'transparent', color: '#6e7681', fontSize: 10, padding: '1px 8px' }}
                    >クリア</button>
                  )}
                </div>
              )}

              <div style={{ maxHeight: 400, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                {filteredNews.length > 0 ? filteredNews.map((item, i) => (
                  <div key={i} className="news-item">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 10, color: '#6e7681', fontFamily: 'monospace' }}>{item.date}</span>
                      <span className="news-source-badge">{item.source}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#e6edf3', lineHeight: 1.4, marginBottom: 4 }}>
                      {item.url ? <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: '#e6edf3', textDecoration: 'none' }}>{item.title}</a> : item.title}
                    </div>
                    <div>
                      {item.appTags?.length > 0 && item.appTags.map(tag => (
                        <span key={`app-${tag}`} className="news-tag" style={{ background: '#d2a8ff18', color: '#d2a8ff', borderColor: '#d2a8ff33', fontWeight: 600 }}>{tag}</span>
                      ))}
                      {item.tags.map(tag => (
                        <span key={tag} className="news-tag" style={{ background: `${TAG_COLORS[tag] ?? '#6e7681'}15`, color: TAG_COLORS[tag] ?? '#6e7681', borderColor: `${TAG_COLORS[tag] ?? '#6e7681'}33` }}>{tag}</span>
                      ))}
                    </div>
                  </div>
                )) : (
                  <div style={{ fontSize: 10, color: '#484f58', textAlign: 'center', padding: 20 }}>
                    該当週のニュースはありません
                  </div>
                )}
              </div>
            </>
          )}

          {section === 'twitter' && (
            <>
              {twitterDaily.length > 0 ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 10, color: '#6e7681' }}>日次ツイート数</span>
                    <span style={{ marginLeft: 'auto', fontSize: 9, color: '#6e7681' }}>
                      直近{twitterDaily.length}日分
                    </span>
                  </div>
                  <ResponsiveContainer width="100%" height={160}>
                    <ComposedChart data={twitterDaily} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={{ stroke: '#30363d' }} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="totalTweets" name="ツイート数" fill="#1da1f266" stroke="#1da1f2" />
                      <Line type="monotone" dataKey="uniqueAuthors" name="ユニーク著者" stroke="#56d364" strokeWidth={1.5} dot={{ r: 2 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                  {twitter?.stats && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <div className="stat-card">
                        <div style={{ fontSize: 9, color: '#6e7681' }}>直近取得</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1da1f2' }}>{twitter.stats.totalTweets ?? 0}件</div>
                      </div>
                      <div className="stat-card">
                        <div style={{ fontSize: 9, color: '#6e7681' }}>著者数</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#56d364' }}>{twitter.stats.uniqueAuthors ?? 0}</div>
                      </div>
                      <div className="stat-card">
                        <div style={{ fontSize: 9, color: '#6e7681' }}>平均本文長</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#d2a8ff' }}>{twitter.stats.avgTextLength ?? 0}字</div>
                      </div>
                    </div>
                  )}
                  {twitter?.tweets?.length > 0 && (
                    <div style={{ marginTop: 10, maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {twitter.tweets.slice(0, 30).map((tw, i) => (
                        <div key={tw.id || i} style={{ padding: '4px 6px', borderRadius: 4, background: '#0d1117', border: '1px solid #21262d' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            {tw.author && <span style={{ fontSize: 10, color: '#1da1f2', fontWeight: 600 }}>@{tw.author}</span>}
                            {tw.pubDate && (
                              <span style={{ fontSize: 9, color: '#6e7681', fontFamily: 'monospace' }}>
                                {String(tw.pubDate).slice(0, 16).replace('T', ' ')}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: '#e6edf3', lineHeight: 1.4 }}>{tw.text}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 11, color: '#6e7681', textAlign: 'center', padding: 20 }}>
                  X(Twitter) の履歴はまだありません — 収集が 1 日以上蓄積されると日次推移が表示されます
                </div>
              )}
            </>
          )}
        </div>
        <div className="panel-footer">{
          section === 'trends' ? '出典: Google Trends' :
          section === 'reviewEvents' && reviewView === 'ranking' && ranking?.source ? `出典: ${ranking.source} + イベントカレンダー` :
          section === 'reviewEvents' ? '出典: レビュー + イベントカレンダー' :
          section === 'compReviewEvents' && compView === 'ranking' && ranking?.source ? `出典: ${ranking.source}` :
          section === 'compReviewEvents' && reviews?.source ? `出典: ${reviews.source}` :
          section === 'twitter' && twitter?.source ? `出典: ${twitter.source}` :
          '過去からの変化を時系列で確認'
        }</div>
      </div>
    </>
  )
})
