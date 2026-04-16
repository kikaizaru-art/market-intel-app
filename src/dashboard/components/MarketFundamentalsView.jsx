import { useState, useMemo, memo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { ChartTooltip } from './shared/index.js'
import { PALETTE, TYPE_COLORS, TAG_COLORS } from '../constants.js'
import { formatDate, isActive, getToday } from '../utils.js'

const APP_PALETTE = ['#388bfd', '#d2a8ff', '#56d364', '#e3b341', '#f85149']

const TABS = [
  { key: 'ranking', label: 'ランキング' },
  { key: 'events', label: 'イベント' },
  { key: 'news', label: 'ニュース' },
]

export default memo(function MarketFundamentalsView({ data: mfData, eventsData, newsData }) {
  const [tab, setTab] = useState('ranking')
  const [appFilter, setAppFilter] = useState('全て')
  const [typeFilter, setTypeFilter] = useState('全て')

  const APP_COLORS = Object.fromEntries((mfData.apps || []).map((a, i) => [a.id, PALETTE[i % PALETTE.length]]))

  /* ---------- Events ---------- */
  const today = getToday()
  const calData = eventsData || { events: [], _apps: [] }
  const EVENT_APPS = useMemo(() => calData._apps || [...new Set(calData.events.map(e => e.app))], [calData])
  const EVENT_APP_COLORS = useMemo(() => Object.fromEntries(EVENT_APPS.map((a, i) => [a, APP_PALETTE[i % APP_PALETTE.length]])), [EVENT_APPS])
  const EVENT_TYPES = useMemo(() => [...new Set(calData.events.map(e => e.type))], [calData])

  const filteredEvents = useMemo(() =>
    calData.events
      .filter(e => appFilter === '全て' || e.app === appFilter)
      .filter(e => typeFilter === '全て' || e.type === typeFilter)
      .sort((a, b) => b.start.localeCompare(a.start)),
    [calData, appFilter, typeFilter])

  const activeEvents = useMemo(() => calData.events.filter(e => isActive(e, today)), [calData, today])

  const appActiveCounts = useMemo(() => {
    const map = {}
    for (const e of activeEvents) map[e.app] = (map[e.app] || 0) + 1
    return map
  }, [activeEvents])

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

  const rankData = useMemo(() => {
    if (!mfData.apps?.length) return []
    const dates = mfData.apps[0].weekly_sales_rank.map(d => d.date)
    return dates.map((date, i) => {
      const row = { date }
      for (const app of mfData.apps) {
        row[app.name] = app.weekly_sales_rank[i]?.rank
      }
      return row
    })
  }, [mfData.apps])

  const rankSummary = useMemo(() =>
    (mfData.apps || []).map(app => {
      const ranks = app.weekly_sales_rank
      const latest = ranks[ranks.length - 1]?.rank ?? 0
      const prev = ranks[ranks.length - 5]?.rank ?? latest
      return { name: app.name, id: app.id, latest, diff: prev - latest }
    }), [mfData.apps])

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-header-left">
          <div className="panel-indicator fundamental-indicator" />
          <span className="panel-title fundamental-title">市場環境</span>
          <span className="panel-tag">ファンダメンタル</span>
        </div>
      </div>

      <div className="panel-body">
        <div className="fundamental-tabs">
          {TABS.map(t => (<button key={t.key} className={`fundamental-tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>))}
        </div>

        {tab === 'ranking' && (
          <>
            <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 4 }}>セールスランキング推移 (低い=上位)</div>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={rankData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={{ stroke: '#30363d' }} tickLine={false} />
                <YAxis reversed domain={[1, 100]} tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                {(mfData.apps || []).map(app => (
                  <Line key={app.id} type="monotone" dataKey={app.name} stroke={APP_COLORS[app.id]} strokeWidth={1.5} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
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

        {tab === 'events' && eventsData && (
          <>
            <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 4 }}>イベントタイムライン (3月〜4月) — 開催中 {activeEvents.length}件</div>
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

            <div style={{ display: 'flex', gap: 4, marginTop: 8, marginBottom: 6, flexWrap: 'wrap' }}>
              {['全て', ...EVENT_APPS].map(opt => (
                <button key={opt} className="causation-filter-btn" onClick={() => setAppFilter(opt)} style={{ borderColor: appFilter === opt ? (EVENT_APP_COLORS[opt] ?? '#f0883e') + '66' : '#30363d', background: appFilter === opt ? (EVENT_APP_COLORS[opt] ?? '#f0883e') + '22' : 'transparent', color: appFilter === opt ? (EVENT_APP_COLORS[opt] ?? '#f0883e') : '#6e7681' }}>{opt}</button>
              ))}
              <span style={{ width: 1, background: '#30363d', margin: '0 2px' }} />
              {['全て', ...EVENT_TYPES].map(opt => (
                <button key={opt} className="causation-filter-btn" onClick={() => setTypeFilter(opt)} style={{ borderColor: typeFilter === opt ? (TYPE_COLORS[opt] ?? '#f0883e') + '66' : '#30363d', background: typeFilter === opt ? (TYPE_COLORS[opt] ?? '#f0883e') + '22' : 'transparent', color: typeFilter === opt ? (TYPE_COLORS[opt] ?? '#f0883e') : '#6e7681' }}>{opt}</button>
              ))}
            </div>

            <div style={{ maxHeight: 140, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {filteredEvents.map((event, i) => (
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

            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              {EVENT_APPS.map(app => (
                <div key={app} className="stat-card">
                  <div style={{ fontSize: 9, color: '#6e7681' }}>{app}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: EVENT_APP_COLORS[app] }}>{appActiveCounts[app] || 0}<span style={{ fontSize: 9, color: '#6e7681' }}>件</span></div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'news' && newsData && (
          <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
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
                  {item.appTags?.length > 0 && item.appTags.map(tag => (
                    <span key={`app-${tag}`} className="news-tag" style={{ background: '#d2a8ff18', color: '#d2a8ff', borderColor: '#d2a8ff33', fontWeight: 600 }}>{tag}</span>
                  ))}
                  {item.tags.map(tag => (
                    <span key={tag} className="news-tag" style={{ background: `${TAG_COLORS[tag] ?? '#6e7681'}15`, color: TAG_COLORS[tag] ?? '#6e7681', borderColor: `${TAG_COLORS[tag] ?? '#6e7681'}33` }}>{tag}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
      <div className="panel-footer">generated data — 実API接続時: App Annie / Sensor Tower / 公式X / RSS</div>
    </div>
  )
})
