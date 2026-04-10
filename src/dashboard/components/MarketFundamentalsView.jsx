import { useState, useMemo, memo } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'

const PALETTE = ['#388bfd', '#d2a8ff', '#56d364']

function formatDate(dateStr) {
  const [, month, day] = dateStr.split('-')
  return day === '05' || day === '04' || day === '01' ? `${parseInt(month)}月` : ''
}

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 6, padding: '8px 12px', fontSize: 11 }}>
      <p style={{ color: '#8b949e', marginBottom: 4 }}>{label}</p>
      {payload.map(p => (
        <p key={p.dataKey || p.name} style={{ color: p.color }}>{p.name}: <strong>{p.value}</strong></p>
      ))}
    </div>
  )
}

export default memo(function MarketFundamentalsView({ data: mfData }) {
  const [tab, setTab] = useState('ranking')

  const TABS = [
    { key: 'ranking', label: 'ランキング' },
    { key: 'sns', label: 'SNSバズ' },
  ]

  const APP_COLORS = Object.fromEntries((mfData.apps || []).map((a, i) => [a.id, PALETTE[i % PALETTE.length]]))

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

  const snsData = (mfData.sns_buzz?.monthly || []).map(m => ({
    month: parseInt(m.month.slice(5)) + '月',
    'X投稿数': m.twitter_mentions,
    'YouTube動画': m.youtube_videos,
    '配信者数': m.streamer_count,
  }))

  const snsMonthly = mfData.sns_buzz?.monthly || []
  const latestSns = snsMonthly[snsMonthly.length - 1]
  const prevSns = snsMonthly[snsMonthly.length - 2]

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

        {tab === 'sns' && latestSns && prevSns && (
          <>
            <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 4 }}>ゲーム業界全体 SNSバズ指標</div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={snsData} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={{ stroke: '#30363d' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="X投稿数" fill="#388bfd" opacity={0.7} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <div className="stat-card"><div style={{ fontSize: 10, color: '#6e7681' }}>X投稿数</div><div style={{ fontSize: 14, fontWeight: 700, color: '#388bfd' }}>{latestSns.twitter_mentions.toLocaleString()}<span style={{ fontSize: 10, marginLeft: 4, color: latestSns.twitter_mentions > prevSns.twitter_mentions ? '#56d364' : '#f85149' }}>{latestSns.twitter_mentions > prevSns.twitter_mentions ? '▲' : '▼'}</span></div></div>
              <div className="stat-card"><div style={{ fontSize: 10, color: '#6e7681' }}>YouTube動画</div><div style={{ fontSize: 14, fontWeight: 700, color: '#f85149' }}>{latestSns.youtube_videos}本</div></div>
              <div className="stat-card"><div style={{ fontSize: 10, color: '#6e7681' }}>配信者数</div><div style={{ fontSize: 14, fontWeight: 700, color: '#56d364' }}>{latestSns.streamer_count}人</div></div>
            </div>
          </>
        )}

      </div>
      <div className="panel-footer">generated data — 実API接続時: App Annie / Sensor Tower / RSS</div>
    </div>
  )
})
