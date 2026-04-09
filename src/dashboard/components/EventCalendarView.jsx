import { useState, useMemo } from 'react'
import calData from '../../../data/mock/event-calendar.json'

const TYPE_COLORS = {
  'ガチャ': '#d2a8ff',
  'コラボ': '#f0883e',
  'シーズン': '#56d364',
  'キャンペーン': '#388bfd',
  'アップデート': '#8b949e',
}

const APP_COLORS = {
  'RPGサーガ': '#d2a8ff',
  'パズルゲームX': '#388bfd',
  'カジュアルラン': '#56d364',
  'ストラテジーZ': '#e3b341',
}

const APPS = Object.keys(APP_COLORS)
const TYPES = Object.keys(TYPE_COLORS)

function isActive(event, today) {
  if (!event.end) return event.start <= today
  return event.start <= today && event.end >= today
}

export default function EventCalendarView() {
  const [appFilter, setAppFilter] = useState('全て')
  const [typeFilter, setTypeFilter] = useState('全て')

  const today = '2026-04-09'

  const filtered = useMemo(() =>
    calData.events
      .filter(e => appFilter === '全て' || e.app === appFilter)
      .filter(e => typeFilter === '全て' || e.type === typeFilter)
      .sort((a, b) => b.start.localeCompare(a.start)),
    [appFilter, typeFilter])

  const activeEvents = calData.events.filter(e => isActive(e, today))

  // タイプ別集計
  const typeCounts = useMemo(() => {
    const map = {}
    for (const e of calData.events) {
      map[e.type] = (map[e.type] || 0) + 1
    }
    return map
  }, [])

  // アプリ別アクティブイベント数
  const appActiveCounts = useMemo(() => {
    const map = {}
    for (const e of activeEvents) {
      map[e.app] = (map[e.app] || 0) + 1
    }
    return map
  }, [activeEvents])

  // タイムラインバー用: 日付範囲
  const timelineStart = '2026-03-10'
  const timelineEnd = '2026-04-28'
  const totalDays = (new Date(timelineEnd) - new Date(timelineStart)) / 86400000

  function barStyle(event) {
    const start = Math.max(0, (new Date(event.start) - new Date(timelineStart)) / 86400000)
    const end = event.end
      ? (new Date(event.end) - new Date(timelineStart)) / 86400000
      : start + 1
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
        {/* タイムラインビジュアル */}
        <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 4 }}>イベントタイムライン (3月〜4月)</div>
        <div className="event-timeline">
          {/* 今日マーカー */}
          <div className="timeline-today" style={{ left: `${((new Date(today) - new Date(timelineStart)) / 86400000 / totalDays) * 100}%` }}>
            <span className="timeline-today-label">今日</span>
          </div>
          {calData.events.map((event, i) => (
            <div key={i} className="timeline-bar-row">
              <span className="timeline-bar-app" style={{ color: APP_COLORS[event.app] }}>{event.app.slice(0, 4)}</span>
              <div className="timeline-bar-track">
                <div
                  className="timeline-bar-fill"
                  style={{
                    ...barStyle(event),
                    background: TYPE_COLORS[event.type],
                    opacity: isActive(event, today) ? 1 : 0.4,
                  }}
                  title={`${event.name} (${event.start}〜${event.end || ''})`}
                />
              </div>
            </div>
          ))}
        </div>

        {/* フィルター */}
        <div style={{ display: 'flex', gap: 4, marginTop: 8, marginBottom: 6, flexWrap: 'wrap' }}>
          {['全て', ...APPS].map(opt => (
            <button
              key={opt}
              className="causation-filter-btn"
              onClick={() => setAppFilter(opt)}
              style={{
                borderColor: appFilter === opt ? (APP_COLORS[opt] ?? '#f0883e') + '66' : '#30363d',
                background: appFilter === opt ? (APP_COLORS[opt] ?? '#f0883e') + '22' : 'transparent',
                color: appFilter === opt ? (APP_COLORS[opt] ?? '#f0883e') : '#6e7681',
              }}
            >
              {opt}
            </button>
          ))}
          <span style={{ width: 1, background: '#30363d', margin: '0 2px' }} />
          {['全て', ...TYPES].map(opt => (
            <button
              key={opt}
              className="causation-filter-btn"
              onClick={() => setTypeFilter(opt)}
              style={{
                borderColor: typeFilter === opt ? (TYPE_COLORS[opt] ?? '#f0883e') + '66' : '#30363d',
                background: typeFilter === opt ? (TYPE_COLORS[opt] ?? '#f0883e') + '22' : 'transparent',
                color: typeFilter === opt ? (TYPE_COLORS[opt] ?? '#f0883e') : '#6e7681',
              }}
            >
              {opt}
            </button>
          ))}
        </div>

        {/* イベントリスト */}
        <div style={{ maxHeight: 140, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {filtered.map((event, i) => (
            <div key={i} className="event-item" style={{ borderLeftColor: TYPE_COLORS[event.type] }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: 10, color: APP_COLORS[event.app], fontWeight: 600 }}>{event.app}</span>
                <span className="event-type-badge" style={{ background: `${TYPE_COLORS[event.type]}22`, color: TYPE_COLORS[event.type], borderColor: `${TYPE_COLORS[event.type]}44` }}>
                  {event.type}
                </span>
                {isActive(event, today) && (
                  <span style={{ fontSize: 9, padding: '0 4px', borderRadius: 3, background: 'rgba(86,211,100,0.15)', color: '#56d364' }}>開催中</span>
                )}
                <span style={{ fontSize: 9, color: '#484f58', marginLeft: 'auto' }}>{event.source}</span>
              </div>
              <div style={{ fontSize: 11, color: '#e6edf3', fontWeight: 500 }}>{event.name}</div>
              <div style={{ fontSize: 9, color: '#6e7681', fontFamily: 'monospace' }}>
                {event.start}{event.end ? ` → ${event.end}` : ''}
              </div>
            </div>
          ))}
        </div>

        {/* サマリー */}
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          {APPS.map(app => (
            <div key={app} className="stat-card">
              <div style={{ fontSize: 9, color: '#6e7681' }}>{app}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: APP_COLORS[app] }}>
                {appActiveCounts[app] || 0}<span style={{ fontSize: 9, color: '#6e7681' }}>件</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel-footer">
        mock data — 実データ: 公式X / ストア更新 / 公式サイト
      </div>
    </div>
  )
}
