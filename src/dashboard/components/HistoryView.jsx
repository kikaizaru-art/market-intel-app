import { useState, useMemo, memo } from 'react'
import {
  LineChart, Line, ComposedChart, Bar,
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceDot,
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

  // ─── Rankings ─────────────────────────────────────
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
  const REVIEW_COLORS = useMemo(() =>
    Object.fromEntries(apps.map((a, i) => [a.id, PALETTE[i % PALETTE.length]])),
    [apps])

  const [selectedReviewApp, setSelectedReviewApp] = useState(apps[0]?.id)

  const reviewApp = apps.find(a => a.id === selectedReviewApp) || apps[0]
  const reviewAccent = REVIEW_COLORS[reviewApp?.id] || PALETTE[0]

  const reviewChartData = useMemo(() =>
    reviewApp?.monthly.map(m => ({
      month: m.month.slice(5) + '月',
      スコア: m.score,
      レビュー数: m.count,
      好意的: Math.round(m.positive_ratio * 100),
    })) || [], [reviewApp])

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

  const [reviewCompare, setReviewCompare] = useState(false)

  // ─── Events ───────────────────────────────────────
  const calData = events || { events: [], _apps: [] }
  const EVENT_APPS = useMemo(() => calData._apps || [...new Set(calData.events.map(e => e.app))], [calData])
  const APP_PALETTE = ['#388bfd', '#d2a8ff', '#56d364', '#e3b341', '#f85149']
  const EVENT_APP_COLORS = useMemo(() =>
    Object.fromEntries(EVENT_APPS.map((a, i) => [a, APP_PALETTE[i % APP_PALETTE.length]])),
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
              <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 4 }}>セールスランキング推移 (低い=上位)</div>
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
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {rankSummary.map(app => (
                  <div key={app.id} className="stat-card">
                    <div style={{ fontSize: 10, color: '#6e7681' }}>{app.name}</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: APP_COLORS[app.id] }}>{app.latest}位</span>
                      <span style={{ fontSize: 10, color: app.diff > 0 ? '#56d364' : app.diff < 0 ? '#f85149' : '#6e7681' }}>
                        {app.diff > 0 ? `▲${app.diff}` : app.diff < 0 ? `▼${Math.abs(app.diff)}` : '→'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ──── レビュー ──── */}
          {section === 'reviews' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div className="app-selector" style={{ marginBottom: 0 }}>
                  {apps.map(app => (
                    <button key={app.id} className={`app-btn ${selectedReviewApp === app.id ? 'active' : ''}`} style={selectedReviewApp === app.id ? { background: `${REVIEW_COLORS[app.id]}22`, borderColor: `${REVIEW_COLORS[app.id]}66`, color: REVIEW_COLORS[app.id] } : {}} onClick={() => setSelectedReviewApp(app.id)}>{app.name}</button>
                  ))}
                </div>
                <button onClick={() => setReviewCompare(v => !v)} className="macro-toggle-btn" style={{ borderColor: reviewCompare ? 'rgba(86,211,100,0.5)' : '#30363d', background: reviewCompare ? 'rgba(86,211,100,0.15)' : 'transparent', color: reviewCompare ? '#56d364' : '#6e7681' }}>比較</button>
              </div>

              {reviewCompare ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={compareData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={{ stroke: '#30363d' }} tickLine={false} />
                    <YAxis domain={[3, 5]} tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    {apps.map(app => (
                      <Line key={app.id} type="monotone" dataKey={app.name} stroke={REVIEW_COLORS[app.id]} strokeWidth={2} dot={{ fill: REVIEW_COLORS[app.id], r: 3 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart data={reviewChartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={{ stroke: '#30363d' }} tickLine={false} />
                    <YAxis yAxisId="left" domain={[0, 5]} tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar yAxisId="right" dataKey="レビュー数" fill={`${reviewAccent}33`} stroke={`${reviewAccent}66`} strokeWidth={1} />
                    <Line yAxisId="left" type="monotone" dataKey="スコア" stroke={reviewAccent} strokeWidth={2} dot={{ fill: reviewAccent, r: 3 }} activeDot={{ r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {apps.map((app, i) => {
                  const latest = app.monthly[app.monthly.length - 1]
                  const prev = app.monthly[app.monthly.length - 2]
                  const diff = prev ? (latest.score - prev.score).toFixed(1) : '0.0'
                  return (
                    <div key={app.id} className="stat-card">
                      <div style={{ fontSize: 10, color: REVIEW_COLORS[app.id], fontWeight: 600 }}>{app.name}</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#e6edf3' }}>★ {latest?.score}</span>
                        <span style={{ fontSize: 10, color: parseFloat(diff) >= 0 ? '#56d364' : '#f85149' }}>
                          {parseFloat(diff) >= 0 ? '▲' : '▼'}{Math.abs(diff)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
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
        <div className="panel-footer">過去からの変化を時系列で確認</div>
      </div>
    </>
  )
})
