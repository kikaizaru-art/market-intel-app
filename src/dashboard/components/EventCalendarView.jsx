import { useState, useMemo, memo } from 'react'
import { TYPE_COLORS, PALETTE } from '../constants.js'
import { isActive, getToday } from '../utils.js'

const APP_PALETTE = ['#388bfd', '#d2a8ff', '#56d364', '#e3b341', '#f85149']

export default memo(function EventCalendarView({ data: calData }) {
  const [appFilter, setAppFilter] = useState('全て')
  const [typeFilter, setTypeFilter] = useState('全て')

  const today = getToday()

  const APPS = useMemo(() => calData._apps || [...new Set(calData.events.map(e => e.app))], [calData])
  const APP_COLORS = useMemo(() => Object.fromEntries(APPS.map((a, i) => [a, APP_PALETTE[i % APP_PALETTE.length]])), [APPS])
  const TYPES = useMemo(() => [...new Set(calData.events.map(e => e.type))], [calData])

  const filtered = useMemo(() =>
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

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-header-left">
          <div className="panel-indicator event-indicator" />
          <span className="panel-title event-title">イベント</span>
          <span className="panel-tag">公開情報ベース</span>
        </div>
        <span className="panel-tag">開催中 {activeEvents.length}件</span>
      </div>

      <div className="panel-body">
        <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 4 }}>イベントタイムライン (3月〜4月)</div>
        <div className="event-timeline">
          <div className="timeline-today" style={{ left: `${((new Date(today) - new Date(timelineStart)) / 86400000 / totalDays) * 100}%` }}>
            <span className="timeline-today-label">今日</span>
          </div>
          {calData.events.map((event, i) => (
            <div key={i} className="timeline-bar-row">
              <span className="timeline-bar-app" style={{ color: APP_COLORS[event.app] }}>{event.app.slice(0, 4)}</span>
              <div className="timeline-bar-track">
                <div className="timeline-bar-fill" style={{ ...barStyle(event), background: TYPE_COLORS[event.type] || '#8b949e', opacity: isActive(event, today) ? 1 : 0.4 }} title={`${event.name} (${event.start}〜${event.end || ''})`} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 4, marginTop: 8, marginBottom: 6, flexWrap: 'wrap' }}>
          {['全て', ...APPS].map(opt => (
            <button key={opt} className="causation-filter-btn" onClick={() => setAppFilter(opt)} style={{ borderColor: appFilter === opt ? (APP_COLORS[opt] ?? '#f0883e') + '66' : '#30363d', background: appFilter === opt ? (APP_COLORS[opt] ?? '#f0883e') + '22' : 'transparent', color: appFilter === opt ? (APP_COLORS[opt] ?? '#f0883e') : '#6e7681' }}>{opt}</button>
          ))}
          <span style={{ width: 1, background: '#30363d', margin: '0 2px' }} />
          {['全て', ...TYPES].map(opt => (
            <button key={opt} className="causation-filter-btn" onClick={() => setTypeFilter(opt)} style={{ borderColor: typeFilter === opt ? (TYPE_COLORS[opt] ?? '#f0883e') + '66' : '#30363d', background: typeFilter === opt ? (TYPE_COLORS[opt] ?? '#f0883e') + '22' : 'transparent', color: typeFilter === opt ? (TYPE_COLORS[opt] ?? '#f0883e') : '#6e7681' }}>{opt}</button>
          ))}
        </div>

        <div style={{ maxHeight: 140, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {filtered.map((event, i) => (
            <div key={i} className="event-item" style={{ borderLeftColor: TYPE_COLORS[event.type] || '#8b949e' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: 10, color: APP_COLORS[event.app], fontWeight: 600 }}>{event.app}</span>
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
          {APPS.map(app => (
            <div key={app} className="stat-card">
              <div style={{ fontSize: 9, color: '#6e7681' }}>{app}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: APP_COLORS[app] }}>{appActiveCounts[app] || 0}<span style={{ fontSize: 9, color: '#6e7681' }}>件</span></div>
            </div>
          ))}
        </div>
      </div>
      <div className="panel-footer">generated data — 実データ: 公式X / ストア更新 / 公式サイト</div>
    </div>
  )
})
