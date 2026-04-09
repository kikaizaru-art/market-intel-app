import { useState, useMemo, memo } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LineChart,
} from 'recharts'

const PALETTE = ['#388bfd', '#d2a8ff', '#56d364', '#e3b341']

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 6, padding: '8px 12px', fontSize: 11 }}>
      <p style={{ color: '#8b949e', marginBottom: 4 }}>{label}</p>
      {payload.map(p => (
        <p key={p.dataKey || p.name} style={{ color: p.color ?? '#56d364' }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  )
}

function SentimentBar({ ratio, color }) {
  const pct = Math.round(ratio * 100)
  return (
    <div className="sentiment-bar-wrap">
      <div className="sentiment-bar-track">
        <div className="sentiment-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="sentiment-bar-label" style={{ color }}>{pct}%</span>
    </div>
  )
}

export default memo(function UserView({ data: reviewsData }) {
  const apps = reviewsData.apps
  const APP_COLORS = Object.fromEntries(apps.map((a, i) => [a.id, PALETTE[i % PALETTE.length]]))

  const [selectedApp, setSelectedApp] = useState(apps[0]?.id)
  const [compareMode, setCompareMode] = useState(false)

  const appData = apps.find(a => a.id === selectedApp) || apps[0]
  const accentColor = APP_COLORS[appData?.id] || PALETTE[0]

  const chartData = appData?.monthly.map(m => ({
    month: m.month.slice(5) + '月',
    スコア: m.score,
    レビュー数: m.count,
    好意的: Math.round(m.positive_ratio * 100),
  })) || []

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

  const appSummaries = useMemo(() =>
    apps.map(app => {
      const latest = app.monthly[app.monthly.length - 1]
      const prev = app.monthly[app.monthly.length - 2]
      const totalReviews = app.monthly.reduce((s, m) => s + m.count, 0)
      return {
        id: app.id, name: app.name,
        score: latest?.score ?? 0,
        diff: prev ? (latest.score - prev.score).toFixed(1) : '0.0',
        sentiment: latest?.positive_ratio ?? 0,
        totalReviews,
      }
    }), [apps])

  const latestScore = appData?.monthly[appData.monthly.length - 1]?.score ?? 0
  const prevScore = appData?.monthly[appData.monthly.length - 2]?.score ?? 0
  const scoreDiff = (latestScore - prevScore).toFixed(1)
  const latestSentiment = appData?.monthly[appData.monthly.length - 1]?.positive_ratio ?? 0

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-header-left">
          <div className="panel-indicator user-indicator" />
          <span className="panel-title user-title">ユーザー</span>
          <span className="panel-tag">ストアレビュー分析</span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={() => setCompareMode(v => !v)} className="macro-toggle-btn" style={{ borderColor: compareMode ? 'rgba(86,211,100,0.5)' : '#30363d', background: compareMode ? 'rgba(86,211,100,0.15)' : 'transparent', color: compareMode ? '#56d364' : '#6e7681' }}>比較</button>
          <span className="panel-tag">App Store / Google Play</span>
        </div>
      </div>

      <div className="panel-body">
        {compareMode ? (
          <>
            <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 6 }}>全アプリ スコア比較</div>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={compareData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={{ stroke: '#30363d' }} tickLine={false} />
                <YAxis domain={[3, 5]} tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                {apps.map(app => (
                  <Line key={app.id} type="monotone" dataKey={app.name} stroke={APP_COLORS[app.id]} strokeWidth={2} dot={{ fill: APP_COLORS[app.id], r: 3 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
            <div className="compare-cards">
              {appSummaries.map(app => (
                <div key={app.id} className="compare-card" style={{ borderLeftColor: APP_COLORS[app.id] }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: APP_COLORS[app.id], marginBottom: 4 }}>{app.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#e6edf3' }}>★ {app.score}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: parseFloat(app.diff) >= 0 ? '#56d364' : '#f85149' }}>
                      {parseFloat(app.diff) >= 0 ? '▲' : '▼'}{Math.abs(app.diff)}
                    </span>
                    <span style={{ fontSize: 10, color: '#6e7681' }}>累計 {app.totalReviews.toLocaleString()}件</span>
                  </div>
                  <SentimentBar ratio={app.sentiment} color={APP_COLORS[app.id]} />
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="app-selector">
              {apps.map(app => (
                <button key={app.id} className={`app-btn ${selectedApp === app.id ? 'active' : ''}`} style={selectedApp === app.id ? { background: `${APP_COLORS[app.id]}22`, borderColor: `${APP_COLORS[app.id]}66`, color: APP_COLORS[app.id] } : {}} onClick={() => setSelectedApp(app.id)}>{app.name}</button>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={{ stroke: '#30363d' }} tickLine={false} />
                <YAxis yAxisId="left" domain={[0, 5]} tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar yAxisId="right" dataKey="レビュー数" fill={`${accentColor}33`} stroke={`${accentColor}66`} strokeWidth={1} />
                <Line yAxisId="left" type="monotone" dataKey="スコア" stroke={accentColor} strokeWidth={2} dot={{ fill: accentColor, r: 3 }} activeDot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <div className="stat-card"><div style={{ fontSize: 10, color: '#6e7681', marginBottom: 2 }}>現在スコア</div><div style={{ fontSize: 16, fontWeight: 700, color: accentColor }}>★ {latestScore}</div></div>
              <div className="stat-card"><div style={{ fontSize: 10, color: '#6e7681', marginBottom: 2 }}>前月比</div><div style={{ fontSize: 14, fontWeight: 700, color: parseFloat(scoreDiff) >= 0 ? '#56d364' : '#f85149' }}>{parseFloat(scoreDiff) >= 0 ? '▲' : '▼'} {Math.abs(scoreDiff)}</div></div>
              <div className="stat-card"><div style={{ fontSize: 10, color: '#6e7681', marginBottom: 2 }}>累計レビュー</div><div style={{ fontSize: 12, fontWeight: 600, color: '#e6edf3' }}>{appData?.monthly.reduce((s, m) => s + m.count, 0).toLocaleString()}件</div></div>
              <div className="stat-card"><div style={{ fontSize: 10, color: '#6e7681', marginBottom: 2 }}>好意的比率</div><SentimentBar ratio={latestSentiment} color={accentColor} /></div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 4 }}>主な不満</div>
                {appData?.top_complaints.map(c => (<span key={c} className="complaint-tag">{c}</span>))}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 4 }}>主な好評点</div>
                {appData?.top_praises.map(p => (<span key={p} className="praise-tag">{p}</span>))}
              </div>
            </div>
          </>
        )}
      </div>
      <div className="panel-footer">generated data — 実API接続時: App Store Connect API / スクレイピング</div>
    </div>
  )
})
