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
  { key: 'reviews', label: 'レビュー' },
  { key: 'events', label: 'イベント' },
  { key: 'reviewEvents', label: 'レビュー×イベント' },
  { key: 'compReviewEvents', label: '競合×イベント' },
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

  const [selectedCompetitor, setSelectedCompetitor] = useState(null)
  const [selectedReviewMonth, setSelectedReviewMonth] = useState(null)
  const [selectedCompMonth, setSelectedCompMonth] = useState(null)
  const selectedCompApp = useMemo(() =>
    apps.find(a => a.id === selectedCompetitor), [apps, selectedCompetitor])
  const compAccent = REVIEW_COLORS[selectedCompetitor] || PALETTE[1]

  const compChartData = useMemo(() => {
    if (!selectedCompApp) return []
    return selectedCompApp.monthly.map(m => ({
      month: m.month.slice(5) + '月',
      スコア: m.score,
      レビュー数: m.count,
      好意的: Math.round(m.positive_ratio * 100),
    }))
  }, [selectedCompApp])

  const mainChartData = useMemo(() => {
    if (!mainApp) return []
    const mainColor = REVIEW_COLORS[mainApp.id] || PALETTE[0]
    return mainApp.monthly.map(m => ({
      month: m.month.slice(5) + '月',
      スコア: m.score,
      レビュー数: m.count,
      好意的: Math.round(m.positive_ratio * 100),
    }))
  }, [mainApp, REVIEW_COLORS])

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

  // ─── Events ───────────────────────────────────────
  const calData = events || { events: [], _apps: [] }
  const EVENT_APPS = useMemo(() => calData._apps || [...new Set(calData.events.map(e => e.app))], [calData])
  const EVENT_APP_COLORS = useMemo(() =>
    Object.fromEntries(EVENT_APPS.map((a, i) => [a, PALETTE[i % PALETTE.length]])),
    [EVENT_APPS])

  const activeEvents = useMemo(() => calData.events.filter(e => isActive(e, today)), [calData, today])

  const timelineStart = '2026-03-10'
  const timelineEnd = '2026-04-28'
  const totalDays = (new Date(timelineEnd) - new Date(timelineStart)) / 86400000

  function barStyle(event) {
    const start = Math.max(0, (new Date(event.start) - new Date(timelineStart)) / 86400000)
    const end = event.end ? (new Date(event.end) - new Date(timelineStart)) / 86400000 : start + 1
    const left = (start / totalDays) * 100
    const width = Math.max(((end - start) / totalDays) * 100, 2)
    return { left: `${left}%`, width: `${width}%` }
  }

  const sortedEvents = useMemo(() =>
    [...calData.events].sort((a, b) => b.start.localeCompare(a.start)),
    [calData])

  // ─── Combined: Reviews × Events ────────────────────
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

  const compEventsLookup = useMemo(() => {
    const eventList = events?.events || []
    if (!eventList.length) return {}
    const lookup = {}
    for (const e of eventList) {
      if (!lookup[e.app]) lookup[e.app] = {}
      const monthKey = e.start.slice(5, 7) + '月'
      if (!lookup[e.app][monthKey]) lookup[e.app][monthKey] = []
      lookup[e.app][monthKey].push(e)
    }
    return lookup
  }, [events])

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

          {/* ──── レビュー ──── */}
          {section === 'reviews' && (
            <>
              {/* ════ 自社レビュー推移 ════ */}
              {mainApp && (() => {
                const latest = mainApp.monthly[mainApp.monthly.length - 1]
                const prev = mainApp.monthly[mainApp.monthly.length - 2]
                const diff = prev ? (latest.score - prev.score).toFixed(1) : '0.0'
                return (
                  <>
                    <div style={{ padding: '6px 8px', borderRadius: 6, background: `${mainAccent}12`, border: `1px solid ${mainAccent}44`, marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: mainAccent }}>{mainApp.name}</span>
                        <span style={{ fontSize: 16, fontWeight: 700, color: '#e6edf3' }}>★{latest?.score}</span>
                        <span style={{ fontSize: 10, fontWeight: 600, color: parseFloat(diff) >= 0 ? '#56d364' : '#f85149' }}>
                          {parseFloat(diff) >= 0 ? '▲' : '▼'}{Math.abs(diff)}
                        </span>
                        <span style={{ marginLeft: 'auto', fontSize: 9, color: '#6e7681' }}>
                          {mainApp.monthly.reduce((s, m) => s + m.count, 0).toLocaleString()}件
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 9, color: '#6e7681', whiteSpace: 'nowrap' }}>好意度</span>
                        <div style={{ flex: 1 }}>
                          <SentimentBar ratio={latest?.positive_ratio ?? 0} color={mainAccent} />
                        </div>
                      </div>
                      {mainApp.top_complaints && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 10, color: '#f85149', marginBottom: 3, fontWeight: 600 }}>主な不満</div>
                            {mainApp.top_complaints.map(c => (<span key={c} className="complaint-tag">{c}</span>))}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 10, color: '#56d364', marginBottom: 3, fontWeight: 600 }}>主な好評点</div>
                            {(mainApp.top_praises || []).map(p => (<span key={p} className="praise-tag">{p}</span>))}
                          </div>
                        </div>
                      )}
                    </div>

                    <ResponsiveContainer width="100%" height={180}>
                      <ComposedChart data={mainChartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={{ stroke: '#30363d' }} tickLine={false} />
                        <YAxis yAxisId="left" domain={[0, 5]} tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar yAxisId="right" dataKey="レビュー数" fill={`${mainAccent}33`} stroke={`${mainAccent}66`} strokeWidth={1} />
                        <Line yAxisId="left" type="monotone" dataKey="スコア" stroke={mainAccent} strokeWidth={2} dot={{ fill: mainAccent, r: 3 }} activeDot={{ r: 4 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </>
                )
              })()}

              {/* ════ 競合比較 ════ */}
              {competitorApps.length > 0 && (
                <>
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #21262d' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#8b949e', marginBottom: 6 }}>競合スコア比較</div>
                    <ResponsiveContainer width="100%" height={160}>
                      <LineChart data={compareData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={{ stroke: '#30363d' }} tickLine={false} />
                        <YAxis domain={[3, 5]} tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        {apps.map(app => (
                          <Line key={app.id} type="monotone" dataKey={app.name} stroke={REVIEW_COLORS[app.id]} strokeWidth={app.isMain || app.id === 'target' ? 2.5 : 1.5} strokeDasharray={app.isMain || app.id === 'target' ? undefined : '4 3'} dot={{ fill: REVIEW_COLORS[app.id], r: 2 }} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 9, color: '#6e7681', marginBottom: 3 }}>競合 — クリックでレビュー表示</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {competitorApps.map(app => {
                        const latest = app.monthly[app.monthly.length - 1]
                        const prev = app.monthly[app.monthly.length - 2]
                        const diff = prev ? (latest.score - prev.score).toFixed(1) : '0.0'
                        const isSelected = selectedCompetitor === app.id
                        return (
                          <div key={app.id}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px', borderBottom: '1px solid #21262d', cursor: 'pointer', borderRadius: isSelected ? 4 : 0, background: isSelected ? `${REVIEW_COLORS[app.id]}11` : 'transparent' }}
                            onClick={() => setSelectedCompetitor(isSelected ? null : app.id)}
                          >
                            <span style={{ fontSize: 10, fontWeight: 600, color: REVIEW_COLORS[app.id], minWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.name}</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#e6edf3' }}>★{latest?.score}</span>
                            <span style={{ fontSize: 9, color: parseFloat(diff) >= 0 ? '#56d364' : '#f85149' }}>
                              {parseFloat(diff) >= 0 ? '▲' : '▼'}{Math.abs(diff)}
                            </span>
                            <div style={{ flex: 1 }}>
                              <SentimentBar ratio={latest?.positive_ratio ?? 0} color={REVIEW_COLORS[app.id]} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* ──── 選択した競合のレビュー詳細 ──── */}
                  {selectedCompApp && (
                    <div style={{ marginTop: 6, padding: '6px 8px', borderRadius: 6, border: `1px solid ${compAccent}33`, background: `${compAccent}08` }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: compAccent, marginBottom: 6 }}>
                        {selectedCompApp.name} のレビュー
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 10, color: '#f85149', marginBottom: 4, fontWeight: 600 }}>不満</div>
                          {(selectedCompApp.top_complaints || []).map((c, i) => (
                            <div key={i} style={{ fontSize: 10, color: '#e6edf3', padding: '2px 0', borderBottom: '1px solid #21262d', lineHeight: 1.4 }}>{c}</div>
                          ))}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 10, color: '#56d364', marginBottom: 4, fontWeight: 600 }}>好評</div>
                          {(selectedCompApp.top_praises || []).map((p, i) => (
                            <div key={i} style={{ fontSize: 10, color: '#e6edf3', padding: '2px 0', borderBottom: '1px solid #21262d', lineHeight: 1.4 }}>{p}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* ──── イベント ──── */}
          {section === 'events' && events && (
            <>
              <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 4 }}>イベントタイムライン — 開催中 {activeEvents.length}件</div>
              <div className="event-timeline">
                <div className="timeline-today" style={{ left: `${((new Date(today) - new Date(timelineStart)) / 86400000 / totalDays) * 100}%` }}>
                  <span className="timeline-today-label">今日</span>
                </div>
                {calData.events.map((event, i) => (
                  <div key={i} className="timeline-bar-row">
                    <span className="timeline-bar-app" style={{ color: EVENT_APP_COLORS[event.app] }}>{event.app.slice(0, 4)}</span>
                    <div className="timeline-bar-track">
                      <div className="timeline-bar-fill" style={{ ...barStyle(event), background: TYPE_COLORS[event.type] || '#8b949e', opacity: isActive(event, today) ? 1 : 0.4 }} title={`${event.name} (${event.start}〜${event.end || ''})`} />
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                {sortedEvents.map((event, i) => (
                  <div key={i} className="event-item" style={{ borderLeftColor: TYPE_COLORS[event.type] || '#8b949e' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 10, color: EVENT_APP_COLORS[event.app], fontWeight: 600 }}>{event.app}</span>
                      <span className="event-type-badge" style={{ background: `${TYPE_COLORS[event.type] || '#8b949e'}22`, color: TYPE_COLORS[event.type] || '#8b949e', borderColor: `${TYPE_COLORS[event.type] || '#8b949e'}44` }}>{event.type}</span>
                      {isActive(event, today) && (<span style={{ fontSize: 9, padding: '0 4px', borderRadius: 3, background: 'rgba(86,211,100,0.15)', color: '#56d364' }}>開催中</span>)}
                      <span style={{ fontSize: 9, color: '#484f58', marginLeft: 'auto' }}>{event.source}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#e6edf3', fontWeight: 500 }}>{event.name}</div>
                    <div style={{ fontSize: 9, color: '#6e7681', fontFamily: 'monospace' }}>{event.start}{event.end ? ` → ${event.end}` : ''}</div>
                  </div>
                ))}
              </div>
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

                return (
                  <>
                    <div style={{ padding: '6px 8px', borderRadius: 6, background: `${mainAccent}12`, border: `1px solid ${mainAccent}44`, marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: mainAccent }}>{mainApp.name}</span>
                        <span style={{ fontSize: 16, fontWeight: 700, color: '#e6edf3' }}>★{latest?.score}</span>
                        <span style={{ fontSize: 10, fontWeight: 600, color: parseFloat(diff) >= 0 ? '#56d364' : '#f85149' }}>
                          {parseFloat(diff) >= 0 ? '▲' : '▼'}{Math.abs(diff)}
                        </span>
                        <span style={{ marginLeft: 'auto', fontSize: 9, color: '#6e7681' }}>
                          レビュー×イベント
                        </span>
                      </div>
                    </div>

                    <ResponsiveContainer width="100%" height={200}>
                      <ComposedChart data={mainChartData} margin={{ top: 16, right: 8, bottom: 0, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={{ stroke: '#30363d' }} tickLine={false} />
                        <YAxis yAxisId="left" domain={[0, 5]} tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar yAxisId="right" dataKey="レビュー数" cursor="pointer" onClick={(data) => setSelectedReviewMonth(prev => prev === data?.month ? null : data?.month)}>
                          {mainChartData.map((entry, idx) => (
                            <Cell key={idx} fill={entry.month === selectedReviewMonth ? `${mainAccent}66` : `${mainAccent}33`} stroke={entry.month === selectedReviewMonth ? mainAccent : `${mainAccent}66`} strokeWidth={entry.month === selectedReviewMonth ? 2 : 1} />
                          ))}
                        </Bar>
                        <Line yAxisId="left" type="monotone" dataKey="スコア" stroke={mainAccent} strokeWidth={2} dot={{ fill: mainAccent, r: 3 }} activeDot={{ r: 4 }} />
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
                      return (
                        <div style={{ margin: '8px 0', padding: '8px 10px', borderRadius: 6, border: `1px solid ${mainAccent}44`, background: `${mainAccent}08` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: mainAccent }}>{selectedReviewMonth}</span>
                            <span style={{ fontSize: 16, fontWeight: 700, color: '#e6edf3' }}>★{monthData.score}</span>
                            {scoreDiff !== null && (
                              <span style={{ fontSize: 10, fontWeight: 600, color: parseFloat(scoreDiff) >= 0 ? '#56d364' : '#f85149' }}>
                                {parseFloat(scoreDiff) >= 0 ? '▲' : '▼'}{Math.abs(parseFloat(scoreDiff))}
                              </span>
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

          {/* ──── 競合×イベント ──── */}
          {section === 'compReviewEvents' && (
            <>
              {competitorApps.length > 0 ? (
                <>
                  <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 4 }}>競合スコア推移×イベント相関</div>

                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={compareData} margin={{ top: 16, right: 8, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={{ stroke: '#30363d' }} tickLine={false} />
                      <YAxis domain={[3, 5]} tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                      {apps.map(app => (
                        <Line key={app.id} type="monotone" dataKey={app.name} stroke={REVIEW_COLORS[app.id]} strokeWidth={app.isMain || app.id === 'target' ? 2.5 : 1.5} strokeDasharray={app.isMain || app.id === 'target' ? undefined : '4 3'} dot={{ fill: REVIEW_COLORS[app.id], r: 2 }} />
                      ))}
                      {competitorApps.flatMap(app => {
                        const appEvents = compEventsLookup[app.name] || {}
                        return Object.keys(appEvents).filter(month => compareData.some(d => d.month === month)).map(month => (
                          <ReferenceLine
                            key={`comp-${app.id}-${month}`}
                            x={month}
                            stroke={`${REVIEW_COLORS[app.id]}88`}
                            strokeDasharray="3 3"
                            strokeWidth={1}
                            label={{ value: appEvents[month][0]?.type || '', position: 'top', fill: `${REVIEW_COLORS[app.id]}88`, fontSize: 8 }}
                          />
                        ))
                      })}
                    </LineChart>
                  </ResponsiveContainer>

                  {/* Competitor selector */}
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#8b949e', marginBottom: 4 }}>アプリ選択 — タップで個別チャート表示</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {competitorApps.map(app => {
                        const latest = app.monthly[app.monthly.length - 1]
                        const prev = app.monthly[app.monthly.length - 2]
                        const diff = prev ? (latest.score - prev.score).toFixed(1) : '0.0'
                        const isSelected = selectedCompetitor === app.id
                        const allEvents = Object.values(compEventsLookup[app.name] || {}).flat()
                        return (
                          <div key={app.id}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderBottom: '1px solid #21262d', cursor: 'pointer', borderRadius: isSelected ? 4 : 0, background: isSelected ? `${REVIEW_COLORS[app.id]}15` : 'transparent', border: isSelected ? `1px solid ${REVIEW_COLORS[app.id]}44` : '1px solid transparent' }}
                            onClick={() => { setSelectedCompetitor(isSelected ? null : app.id); setSelectedCompMonth(null) }}
                          >
                            <span style={{ fontSize: 10, fontWeight: 600, color: REVIEW_COLORS[app.id], minWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.name}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#e6edf3' }}>★{latest?.score}</span>
                            <span style={{ fontSize: 9, color: parseFloat(diff) >= 0 ? '#56d364' : '#f85149' }}>
                              {parseFloat(diff) >= 0 ? '▲' : '▼'}{Math.abs(diff)}
                            </span>
                            {allEvents.length > 0 && <span style={{ fontSize: 9, color: '#484f58' }}>{allEvents.length}件</span>}
                            <div style={{ flex: 1 }}>
                              <SentimentBar ratio={latest?.positive_ratio ?? 0} color={REVIEW_COLORS[app.id]} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Selected competitor detail — same structure as self view */}
                  {selectedCompApp && (() => {
                    const accent = compAccent
                    const latest = selectedCompApp.monthly[selectedCompApp.monthly.length - 1]
                    const prev = selectedCompApp.monthly[selectedCompApp.monthly.length - 2]
                    const diff = prev ? (latest.score - prev.score).toFixed(1) : '0.0'
                    const compEventsByMonth = compEventsLookup[selectedCompApp.name] || {}
                    const compEventMonths = Object.keys(compEventsByMonth)
                    const compChartMonthSet = new Set(compChartData.map(d => d.month))
                    const compExtraMonths = compEventMonths.filter(m => !compChartMonthSet.has(m)).sort()

                    return (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${accent}33` }}>
                        {/* Header card */}
                        <div style={{ padding: '6px 8px', borderRadius: 6, background: `${accent}12`, border: `1px solid ${accent}44`, marginBottom: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: accent }}>{selectedCompApp.name}</span>
                            <span style={{ fontSize: 16, fontWeight: 700, color: '#e6edf3' }}>★{latest?.score}</span>
                            <span style={{ fontSize: 10, fontWeight: 600, color: parseFloat(diff) >= 0 ? '#56d364' : '#f85149' }}>
                              {parseFloat(diff) >= 0 ? '▲' : '▼'}{Math.abs(diff)}
                            </span>
                            <span style={{ marginLeft: 'auto', fontSize: 9, color: '#6e7681' }}>
                              {selectedCompApp.monthly.reduce((s, m) => s + m.count, 0).toLocaleString()}件
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 9, color: '#6e7681', whiteSpace: 'nowrap' }}>好意度</span>
                            <div style={{ flex: 1 }}><SentimentBar ratio={latest?.positive_ratio ?? 0} color={accent} /></div>
                          </div>
                        </div>

                        {/* ComposedChart with clickable bars */}
                        <ResponsiveContainer width="100%" height={200}>
                          <ComposedChart data={compChartData} margin={{ top: 16, right: 8, bottom: 0, left: -20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                            <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={{ stroke: '#30363d' }} tickLine={false} />
                            <YAxis yAxisId="left" domain={[0, 5]} tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={false} tickLine={false} />
                            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={false} tickLine={false} />
                            <Tooltip content={<ChartTooltip />} />
                            <Bar yAxisId="right" dataKey="レビュー数" cursor="pointer" onClick={(data) => setSelectedCompMonth(p => p === data?.month ? null : data?.month)}>
                              {compChartData.map((entry, idx) => (
                                <Cell key={idx} fill={entry.month === selectedCompMonth ? `${accent}66` : `${accent}33`} stroke={entry.month === selectedCompMonth ? accent : `${accent}66`} strokeWidth={entry.month === selectedCompMonth ? 2 : 1} />
                              ))}
                            </Bar>
                            <Line yAxisId="left" type="monotone" dataKey="スコア" stroke={accent} strokeWidth={2} dot={{ fill: accent, r: 3 }} activeDot={{ r: 4 }} />
                            {compEventMonths.filter(m => compChartMonthSet.has(m)).map(month => (
                              <ReferenceLine
                                key={`cev-${month}`}
                                x={month}
                                yAxisId="left"
                                stroke={TYPE_COLORS[compEventsByMonth[month][0]?.type] || '#8b949e'}
                                strokeDasharray="4 3"
                                strokeWidth={1.5}
                                label={{ value: compEventsByMonth[month][0]?.type || '', position: 'top', fill: TYPE_COLORS[compEventsByMonth[month][0]?.type] || '#8b949e', fontSize: 9 }}
                              />
                            ))}
                          </ComposedChart>
                        </ResponsiveContainer>

                        {/* Selected month detail panel */}
                        {selectedCompMonth && (() => {
                          const monthData = selectedCompApp.monthly.find(m => m.month.slice(5) + '月' === selectedCompMonth)
                          if (!monthData) return null
                          const monthEvents = compEventsByMonth[selectedCompMonth] || []
                          const prevIdx = selectedCompApp.monthly.indexOf(monthData) - 1
                          const prevData = prevIdx >= 0 ? selectedCompApp.monthly[prevIdx] : null
                          const scoreDiff = prevData ? (monthData.score - prevData.score).toFixed(1) : null
                          return (
                            <div style={{ margin: '8px 0', padding: '8px 10px', borderRadius: 6, border: `1px solid ${accent}44`, background: `${accent}08` }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: accent }}>{selectedCompMonth}</span>
                                <span style={{ fontSize: 16, fontWeight: 700, color: '#e6edf3' }}>★{monthData.score}</span>
                                {scoreDiff !== null && (
                                  <span style={{ fontSize: 10, fontWeight: 600, color: parseFloat(scoreDiff) >= 0 ? '#56d364' : '#f85149' }}>
                                    {parseFloat(scoreDiff) >= 0 ? '▲' : '▼'}{Math.abs(parseFloat(scoreDiff))}
                                  </span>
                                )}
                                <span style={{ fontSize: 10, color: '#6e7681' }}>{monthData.count.toLocaleString()}件</span>
                                <span style={{ marginLeft: 'auto', fontSize: 9, color: '#484f58', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setSelectedCompMonth(null) }}>✕ 閉じる</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: monthEvents.length ? 8 : 0 }}>
                                <span style={{ fontSize: 9, color: '#6e7681', whiteSpace: 'nowrap' }}>好意度</span>
                                <div style={{ flex: 1 }}><SentimentBar ratio={monthData.positive_ratio} color={accent} /></div>
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

                        {!selectedCompMonth && <div style={{ fontSize: 9, color: '#484f58', textAlign: 'center', marginTop: 4 }}>棒グラフをタップで月別詳細を表示</div>}

                        {/* Event detail strip */}
                        {compEventMonths.length > 0 && (
                          <div style={{ marginTop: 6 }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: '#8b949e', marginBottom: 4 }}>関連イベント</div>
                            {compChartData.map(d => {
                              const evts = compEventsByMonth[d.month]
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
                            {compExtraMonths.map(month => (
                              <div key={month} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 0', borderBottom: '1px solid #21262d', opacity: 0.7 }}>
                                <span style={{ fontSize: 10, color: '#484f58', minWidth: 32, fontFamily: 'monospace', fontWeight: 600 }}>{month}</span>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, flex: 1 }}>
                                  {compEventsByMonth[month].map((e, i) => (
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

                        {compEventMonths.length === 0 && (
                          <div style={{ marginTop: 8, fontSize: 10, color: '#484f58', textAlign: 'center', padding: 8 }}>
                            この期間のイベントデータはありません
                          </div>
                        )}

                        {/* Complaints / Praises */}
                        {selectedCompApp.top_complaints && (
                          <div style={{ display: 'flex', gap: 8, marginTop: 8, paddingTop: 8, borderTop: '1px solid #21262d' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 10, color: '#f85149', marginBottom: 3, fontWeight: 600 }}>主な不満</div>
                              {selectedCompApp.top_complaints.map((c, i) => (<span key={i} className="complaint-tag">{c}</span>))}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 10, color: '#56d364', marginBottom: 3, fontWeight: 600 }}>主な好評点</div>
                              {(selectedCompApp.top_praises || []).map((p, i) => (<span key={i} className="praise-tag">{p}</span>))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })()}
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
          section === 'reviews' && reviews?.source ? `出典: ${reviews.source}` :
          section === 'trends' ? '出典: Google Trends' :
          section === 'ranking' && ranking?.source ? `出典: ${ranking.source}` :
          section === 'reviewEvents' ? '出典: レビュー + イベントカレンダー' :
          section === 'compReviewEvents' ? '出典: レビュー + イベントカレンダー' :
          '過去からの変化を時系列で確認'
        }</div>
      </div>
    </>
  )
})
