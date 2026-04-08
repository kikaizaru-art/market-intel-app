import { useState } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import reviewsData from '../../../data/mock/store-reviews.json'

const APP_COLORS = {
  'puzzle-x':   '#388bfd',
  'rpg-saga':   '#d2a8ff',
  'casual-run': '#56d364',
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#161b22', border: '1px solid #30363d',
      borderRadius: 6, padding: '8px 12px', fontSize: 11,
    }}>
      <p style={{ color: '#8b949e', marginBottom: 4 }}>{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color ?? '#56d364' }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  )
}

export default function UserView() {
  const [selectedApp, setSelectedApp] = useState('puzzle-x')

  const appData = reviewsData.apps.find(a => a.id === selectedApp)
  const accentColor = APP_COLORS[selectedApp]

  const chartData = appData.monthly.map(m => ({
    month: m.month.slice(5) + '月',
    スコア: m.score,
    レビュー数: m.count,
    好意的: Math.round(m.positive_ratio * 100),
  }))

  const latestScore = appData.monthly[appData.monthly.length - 1].score
  const prevScore = appData.monthly[appData.monthly.length - 2].score
  const scoreDiff = (latestScore - prevScore).toFixed(1)

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-header-left">
          <div className="panel-indicator user-indicator" />
          <span className="panel-title user-title">ユーザー</span>
          <span className="panel-tag">ストアレビュー分析</span>
        </div>
        <span className="panel-tag">App Store / Google Play</span>
      </div>

      <div className="panel-body">
        {/* アプリ選択 */}
        <div className="app-selector">
          {reviewsData.apps.map(app => (
            <button
              key={app.id}
              className={`app-btn ${selectedApp === app.id ? 'active' : ''}`}
              style={selectedApp === app.id ? {
                background: `${APP_COLORS[app.id]}22`,
                borderColor: `${APP_COLORS[app.id]}66`,
                color: APP_COLORS[app.id],
              } : {}}
              onClick={() => setSelectedApp(app.id)}
            >
              {app.name}
            </button>
          ))}
        </div>

        {/* スコア推移チャート（バー＋ライン複合） */}
        <ResponsiveContainer width="100%" height={170}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 10, fill: '#6e7681' }}
              axisLine={{ stroke: '#30363d' }}
              tickLine={false}
            />
            <YAxis
              yAxisId="left"
              domain={[0, 5]}
              tick={{ fontSize: 10, fill: '#6e7681' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 10, fill: '#6e7681' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              yAxisId="right"
              dataKey="レビュー数"
              fill={`${accentColor}33`}
              stroke={`${accentColor}66`}
              strokeWidth={1}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="スコア"
              stroke={accentColor}
              strokeWidth={2}
              dot={{ fill: accentColor, r: 3 }}
              activeDot={{ r: 4 }}
            />
          </ComposedChart>
        </ResponsiveContainer>

        {/* スタッツ */}
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <div style={{
            flex: 1, background: '#0d1117', borderRadius: 6,
            padding: '6px 10px', border: '1px solid #21262d',
          }}>
            <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 2 }}>現在スコア</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: accentColor }}>
              ★ {latestScore}
            </div>
          </div>
          <div style={{
            flex: 1, background: '#0d1117', borderRadius: 6,
            padding: '6px 10px', border: '1px solid #21262d',
          }}>
            <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 2 }}>前月比</div>
            <div style={{
              fontSize: 14, fontWeight: 700,
              color: parseFloat(scoreDiff) >= 0 ? '#56d364' : '#f85149',
            }}>
              {parseFloat(scoreDiff) >= 0 ? '▲' : '▼'} {Math.abs(scoreDiff)}
            </div>
          </div>
          <div style={{
            flex: 2, background: '#0d1117', borderRadius: 6,
            padding: '6px 10px', border: '1px solid #21262d',
          }}>
            <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 3 }}>主な不満</div>
            <div>
              {appData.top_complaints.map(c => (
                <span key={c} className="complaint-tag">{c}</span>
              ))}
            </div>
          </div>
        </div>

        {/* 高評価ポイント */}
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 4 }}>主な好評点</div>
          {appData.top_praises.map(p => (
            <span key={p} className="praise-tag">{p}</span>
          ))}
        </div>
      </div>

      <div className="panel-footer">
        mock data — 実API接続時: App Store Connect API / スクレイピング
      </div>
    </div>
  )
}
