import { useState, useMemo, memo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceDot,
} from 'recharts'
import { movingAverage, calcGenreTrends } from '../../analyzers/trend.js'
import { detectAllAnomalies } from '../../analyzers/anomaly.js'

const PALETTE = ['#388bfd', '#d2a8ff', '#56d364', '#e3b341', '#79c0ff']

const TREND_LABELS = { rising: '上昇', falling: '下降', stable: '横ばい' }
const TREND_ICONS = { rising: '▲', falling: '▼', stable: '→' }
const TREND_COLORS = { rising: '#56d364', falling: '#f85149', stable: '#e3b341' }

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
        <p key={p.dataKey || p.name} style={{ color: p.color }}>
          {p.name}: <strong>{typeof p.value === 'number' ? p.value.toFixed?.(1) ?? p.value : p.value}</strong>
        </p>
      ))}
    </div>
  )
}

export default memo(function MacroView({ data }) {
  const GENRES = data._genres || Object.keys(data.weekly[0] || {}).filter(k => k !== 'date')
  const GENRE_COLORS = Object.fromEntries(GENRES.map((g, i) => [g, PALETTE[i % PALETTE.length]]))

  const [activeGenres, setActiveGenres] = useState(new Set(GENRES))
  const [showMA, setShowMA] = useState(false)

  function toggleGenre(genre) {
    setActiveGenres(prev => {
      const next = new Set(prev)
      next.has(genre) ? next.delete(genre) : next.add(genre)
      return next
    })
  }

  const weeklyData = data.weekly

  const chartData = useMemo(() => {
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

  const latest = weeklyData[weeklyData.length - 1]
  const prev = weeklyData[weeklyData.length - 5]
  const topGenre = GENRES.reduce((a, b) => (latest[a] ?? 0) > (latest[b] ?? 0) ? a : b)

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-header-left">
          <div className="panel-indicator macro-indicator" />
          <span className="panel-title macro-title">マクロ</span>
          <span className="panel-tag">ジャンル検索トレンド</span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            onClick={() => setShowMA(v => !v)}
            className="macro-toggle-btn"
            style={{
              borderColor: showMA ? 'rgba(56,139,253,0.5)' : '#30363d',
              background: showMA ? 'rgba(56,139,253,0.15)' : 'transparent',
              color: showMA ? '#388bfd' : '#6e7681',
            }}
          >
            MA4
          </button>
          <span className="panel-tag">Google Trends (JP)</span>
        </div>
      </div>

      <div className="panel-body">
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

        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
            <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={{ stroke: '#30363d' }} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
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
            return (
              <span key={genre} className="trend-badge" style={{ borderColor: `${GENRE_COLORS[genre]}44`, background: `${GENRE_COLORS[genre]}11` }}>
                <span style={{ color: GENRE_COLORS[genre], fontWeight: 600 }}>{genre}</span>
                <span style={{ color: TREND_COLORS[t.trend], fontSize: 10 }}>{TREND_ICONS[t.trend]} {TREND_LABELS[t.trend]}</span>
                <span style={{ color: '#6e7681', fontSize: 10 }}>({t.pop4w > 0 ? '+' : ''}{t.pop4w}%)</span>
              </span>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <div style={{ flex: 1, background: '#0d1117', borderRadius: 6, padding: '6px 10px', border: '1px solid #21262d' }}>
            <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 2 }}>最強ジャンル</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: GENRE_COLORS[topGenre] }}>
              {topGenre}<span style={{ fontSize: 11, color: '#8b949e', marginLeft: 4 }}>({latest[topGenre]})</span>
            </div>
          </div>
          <div style={{ flex: 1, background: '#0d1117', borderRadius: 6, padding: '6px 10px', border: '1px solid #21262d' }}>
            <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 2 }}>{GENRES[0]} 4週トレンド</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: (latest[GENRES[0]] ?? 0) >= (prev?.[GENRES[0]] ?? 0) ? '#56d364' : '#f85149' }}>
              {(latest[GENRES[0]] ?? 0) >= (prev?.[GENRES[0]] ?? 0) ? '▲' : '▼'}
              {Math.abs((latest[GENRES[0]] ?? 0) - (prev?.[GENRES[0]] ?? 0))} pts
            </div>
          </div>
          <div style={{ flex: 1, background: '#0d1117', borderRadius: 6, padding: '6px 10px', border: '1px solid #21262d' }}>
            <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 2 }}>異常検知</div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>
              {anomalies.length > 0 ? <span style={{ color: '#f85149' }}>{anomalies.length}件検出</span> : <span style={{ color: '#56d364' }}>正常</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="panel-footer">
        generated data — 実API接続時: pytrends / Google Trends API
      </div>
    </div>
  )
})
