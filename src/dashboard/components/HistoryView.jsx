import { useState, useMemo, memo } from 'react'
import {
  LineChart, Line, ComposedChart, Bar,
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceDot, ReferenceLine, Cell,
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
  { key: 'trends', label: 'トレンド' },
  { key: 'ranking', label: 'ランキング' },
  { key: 'reviewEvents', label: 'レビュー×イベント' },
  { key: 'compReviewEvents', label: '競合推移' },
  { key: 'news', label: 'ニュース' },
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
}) {
  const [section, setSection] = useState('trends')
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
  const APP_COLORS = useMemo(() =>
    Object.fromEntries((fundamentals?.apps || []).map((a, i) => [a.id, PALETTE[i % PALETTE.length]])),
    [fundamentals?.apps])

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

  const rankSummary = useMemo(() =>
    (fundamentals?.apps || []).map(app => {
      const ranks = app.weekly_sales_rank
      const latest = ranks[ranks.length - 1]?.rank ?? 0
      const prev = ranks[ranks.length - 5]?.rank ?? latest
      return { name: app.name, id: app.id, latest, diff: prev - latest }
    }), [fundamentals?.apps])

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

          {/* ──── ランキング ──── */}
          {section === 'ranking' && (
            <>
              <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 4 }}>
                {ranking?.source ? `${ranking.source} (実データ)` : 'セールスランキング推移 (低い=上位)'}
              </div>
              {/* 実データ日次履歴がある場合 */}
              {ranking?.history?.length > 1 ? (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={realRankHistoryData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                      <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={{ stroke: '#30363d' }} tickLine={false} />
                      <YAxis reversed domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                      {realRankTargets.map((name, i) => (
                        <Line key={name} type="monotone" dataKey={name} stroke={PALETTE[i % PALETTE.length]} strokeWidth={1.5} dot={{ r: 2 }} connectNulls />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 4, marginTop: 8 }}>
                    {(ranking.positions || []).map((pos, i) => (
                      <div key={pos.id} className="stat-card" style={{ padding: '4px 8px' }}>
                        <div style={{ fontSize: 9, color: PALETTE[i % PALETTE.length], fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pos.name}</div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: '#e6edf3' }}>{pos.rank}位</span>
                          <span style={{ fontSize: 8, color: '#6e7681' }}>{pos.collection === 'top_grossing' ? '売上' : '無料'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                /* モックデータ */
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={rankData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                      <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={{ stroke: '#30363d' }} tickLine={false} />
                      <YAxis reversed domain={[1, 100]} tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                      {(fundamentals?.apps || []).map(app => (
                        <Line key={app.id} type="monotone" dataKey={app.name} stroke={APP_COLORS[app.id]} strokeWidth={1.5} dot={false} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 4, marginTop: 8 }}>
                    {rankSummary.map(app => (
                      <div key={app.id} className="stat-card" style={{ padding: '4px 8px' }}>
                        <div style={{ fontSize: 9, color: '#6e7681', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.name}</div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: APP_COLORS[app.id] }}>{app.latest}位</span>
                          <span style={{ fontSize: 9, color: app.diff > 0 ? '#56d364' : app.diff < 0 ? '#f85149' : '#6e7681' }}>
                            {app.diff > 0 ? `▲${app.diff}` : app.diff < 0 ? `▼${Math.abs(app.diff)}` : '→'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* ──── レビュー×イベント (自社) ──── */}
          {section === 'reviewEvents' && (
            <>
              {mainApp ? (() => {
                const latest = mainApp.monthly[mainApp.monthly.length - 1]
                const prev = mainApp.monthly[mainApp.monthly.length - 2]
                const diff = prev ? (latest.score - prev.score).toFixed(1) : '0.0'
                const eventMonths = Object.keys(mainAppEventsByMonth)
                const chartMonthSet = new Set(mainChartData.map(d => d.month))
                const extraMonths = eventMonths.filter(m => !chartMonthSet.has(m)).sort()

                // ranking mode 用
                const latestRank = [...mainRankChartData].reverse().find(d => d.順位 != null)?.順位
                const prevRankIdx = mainRankChartData.findIndex(d => d.順位 === latestRank)
                const prevRank = prevRankIdx > 0
                  ? [...mainRankChartData.slice(0, prevRankIdx)].reverse().find(d => d.順位 != null)?.順位
                  : null
                const rankDiff = prevRank != null && latestRank != null ? prevRank - latestRank : 0
                const showRanking = reviewView === 'ranking' && mainRankHasData

                return (
                  <>
                    <div style={{ padding: '6px 8px', borderRadius: 6, background: `${mainAccent}12`, border: `1px solid ${mainAccent}44`, marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: mainAccent }}>{mainApp.name}</span>
                        {showRanking ? (
                          <>
                            <span style={{ fontSize: 16, fontWeight: 700, color: '#e6edf3' }}>{latestRank != null ? `${latestRank}位` : '—'}</span>
                            {latestRank != null && prevRank != null && (
                              <span style={{ fontSize: 10, fontWeight: 600, color: rankDiff > 0 ? '#56d364' : rankDiff < 0 ? '#f85149' : '#6e7681' }}>
                                {rankDiff > 0 ? `▲${rankDiff}` : rankDiff < 0 ? `▼${Math.abs(rankDiff)}` : '→'}
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <span style={{ fontSize: 16, fontWeight: 700, color: '#e6edf3' }}>★{latest?.score}</span>
                            <span style={{ fontSize: 10, fontWeight: 600, color: parseFloat(diff) >= 0 ? '#56d364' : '#f85149' }}>
                              {parseFloat(diff) >= 0 ? '▲' : '▼'}{Math.abs(diff)}
                            </span>
                          </>
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

          {/* ──── 競合推移 ──── */}
          {section === 'compReviewEvents' && (
            <>
              {competitorApps.length > 0 ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ fontSize: 10, color: '#6e7681' }}>
                      {compView === 'score' ? '競合スコア推移' : '競合順位推移 (低い=上位)'}
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
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
                        className="macro-toggle-btn"
                        style={{
                          borderColor: compView === 'ranking' ? 'rgba(56,139,253,0.5)' : '#30363d',
                          background: compView === 'ranking' ? 'rgba(56,139,253,0.15)' : 'transparent',
                          color: compView === 'ranking' ? '#388bfd' : '#6e7681',
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
                      {compRankChartData.length > 0 && competitorRankSummary.length > 0 ? (
                        <>
                          <ResponsiveContainer width="100%" height={180}>
                            <LineChart data={compRankChartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                              <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={{ stroke: '#30363d' }} tickLine={false} />
                              <YAxis reversed domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={false} tickLine={false} />
                              <Tooltip content={<ChartTooltip />} />
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

                          {/* Competitor list — latest rank */}
                          <div style={{ marginTop: 6 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                              {competitorRankSummary.map(app => (
                                <div key={app.id} style={{ padding: '5px 8px', borderBottom: '1px solid #21262d' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ fontSize: 10, fontWeight: 600, color: REVIEW_COLORS[app.id] || '#6e7681', minWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.name}</span>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: '#e6edf3' }}>{app.latest}位</span>
                                    <span style={{ fontSize: 9, color: app.diff > 0 ? '#56d364' : app.diff < 0 ? '#f85149' : '#6e7681' }}>
                                      {app.diff > 0 ? `▲${app.diff}` : app.diff < 0 ? `▼${Math.abs(app.diff)}` : '→'}
                                    </span>
                                    {app.collection && (
                                      <span style={{ fontSize: 9, color: '#6e7681' }}>{app.collection === 'top_grossing' ? '売上' : '無料'}</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      ) : (
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
            <div style={{ maxHeight: 400, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {newsData.map((item, i) => (
                <div key={i} className="news-item">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ fontSize: 10, color: '#6e7681', fontFamily: 'monospace' }}>{item.date}</span>
                    <span className="news-source-badge">{item.source}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#e6edf3', lineHeight: 1.4, marginBottom: 4 }}>
                    {item.url ? <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: '#e6edf3', textDecoration: 'none' }}>{item.title}</a> : item.title}
                  </div>
                  <div>
                    {item.tags.map(tag => (
                      <span key={tag} className="news-tag" style={{ background: `${TAG_COLORS[tag] ?? '#6e7681'}15`, color: TAG_COLORS[tag] ?? '#6e7681', borderColor: `${TAG_COLORS[tag] ?? '#6e7681'}33` }}>{tag}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="panel-footer">{
          section === 'trends' ? '出典: Google Trends' :
          section === 'ranking' && ranking?.source ? `出典: ${ranking.source}` :
          section === 'reviewEvents' && reviewView === 'ranking' && ranking?.source ? `出典: ${ranking.source} + イベントカレンダー` :
          section === 'reviewEvents' ? '出典: レビュー + イベントカレンダー' :
          section === 'compReviewEvents' && compView === 'ranking' && ranking?.source ? `出典: ${ranking.source}` :
          section === 'compReviewEvents' && reviews?.source ? `出典: ${reviews.source}` :
          '過去からの変化を時系列で確認'
        }</div>
      </div>
    </>
  )
})
