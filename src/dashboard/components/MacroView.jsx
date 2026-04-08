import { useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import trendsData from '../../../data/mock/trends.json'

const GENRE_COLORS = {
  'パズル':     '#388bfd',
  'RPG':        '#d2a8ff',
  'カジュアル': '#56d364',
  'ストラテジー': '#e3b341',
  'スポーツ':   '#79c0ff',
}

const GENRES = Object.keys(GENRE_COLORS)

// X軸ラベル: 月頭のみ表示
function formatDate(dateStr) {
  const [, month, day] = dateStr.split('-')
  return day === '05' || day === '04' || day === '01' ? `${parseInt(month)}月` : ''
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
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  )
}

export default function MacroView() {
  const [activeGenres, setActiveGenres] = useState(new Set(GENRES))

  function toggleGenre(genre) {
    setActiveGenres(prev => {
      const next = new Set(prev)
      next.has(genre) ? next.delete(genre) : next.add(genre)
      return next
    })
  }

  const data = trendsData.weekly

  // 最新週の値でトレンドサマリー
  const latest = data[data.length - 1]
  const prev = data[data.length - 5]
  const topGenre = GENRES.reduce((a, b) => latest[a] > latest[b] ? a : b)

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-header-left">
          <div className="panel-indicator macro-indicator" />
          <span className="panel-title macro-title">マクロ</span>
          <span className="panel-tag">ジャンル検索トレンド</span>
        </div>
        <span className="panel-tag">Google Trends (JP)</span>
      </div>

      <div className="panel-body">
        {/* ジャンル凡例 / フィルター */}
        <div className="genre-legend">
          {GENRES.map(genre => (
            <button
              key={genre}
              className="legend-item"
              onClick={() => toggleGenre(genre)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                opacity: activeGenres.has(genre) ? 1 : 0.35,
                padding: '2px 4px', borderRadius: 4,
              }}
            >
              <span className="legend-dot" style={{ background: GENRE_COLORS[genre] }} />
              <span style={{ color: activeGenres.has(genre) ? '#e6edf3' : '#6e7681', fontSize: 11 }}>
                {genre}
              </span>
            </button>
          ))}
        </div>

        {/* ラインチャート */}
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tick={{ fontSize: 10, fill: '#6e7681' }}
              axisLine={{ stroke: '#30363d' }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: '#6e7681' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            {GENRES.map(genre => activeGenres.has(genre) && (
              <Line
                key={genre}
                type="monotone"
                dataKey={genre}
                stroke={GENRE_COLORS[genre]}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>

        {/* サマリーカード */}
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <div style={{
            flex: 1, background: '#0d1117', borderRadius: 6,
            padding: '6px 10px', border: '1px solid #21262d',
          }}>
            <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 2 }}>最強ジャンル</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: GENRE_COLORS[topGenre] }}>
              {topGenre}
              <span style={{ fontSize: 11, color: '#8b949e', marginLeft: 4 }}>
                ({latest[topGenre]})
              </span>
            </div>
          </div>
          <div style={{
            flex: 1, background: '#0d1117', borderRadius: 6,
            padding: '6px 10px', border: '1px solid #21262d',
          }}>
            <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 2 }}>RPG 4週トレンド</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: latest['RPG'] >= prev['RPG'] ? '#56d364' : '#f85149' }}>
              {latest['RPG'] >= prev['RPG'] ? '▲' : '▼'}
              {Math.abs(latest['RPG'] - prev['RPG'])} pts
            </div>
          </div>
          <div style={{
            flex: 1, background: '#0d1117', borderRadius: 6,
            padding: '6px 10px', border: '1px solid #21262d',
          }}>
            <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 2 }}>観測期間</div>
            <div style={{ fontSize: 11, color: '#8b949e' }}>
              {data[0].date}<br />→ {data[data.length - 1].date}
            </div>
          </div>
        </div>
      </div>

      <div className="panel-footer">
        mock data — 実API接続時: pytrends / Google Trends API
      </div>
    </div>
  )
}
