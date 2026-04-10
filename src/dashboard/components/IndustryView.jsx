import { useState, useMemo, memo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
  LineChart, Line, ReferenceDot,
} from 'recharts'
import { movingAverage, calcGenreTrends } from '../../analyzers/trend.js'
import { detectAllAnomalies } from '../../analyzers/anomaly.js'

const GENRE_COLORS = {
  'パズル': '#388bfd', 'RPG': '#d2a8ff', 'カジュアル': '#56d364',
  'ストラテジー': '#e3b341', 'スポーツ': '#79c0ff', 'アクション': '#f85149',
  'シミュレーション': '#f0883e', 'その他': '#484f58',
}

const TREND_PALETTE = ['#388bfd', '#d2a8ff', '#56d364', '#e3b341', '#79c0ff']
const TREND_LABELS = { rising: '上昇', falling: '下降', stable: '横ばい' }
const TREND_ICONS = { rising: '▲', falling: '▼', stable: '→' }
const TREND_COLORS = { rising: '#56d364', falling: '#f85149', stable: '#e3b341' }
const CPI_TREND_COLORS = { rising: '#f85149', falling: '#56d364', stable: '#e3b341' }

const TAG_COLORS = {
  '市場動向': '#388bfd', 'RPG': '#d2a8ff', '競合': '#f85149',
  'ストラテジー': '#e3b341', 'ランキング': '#79c0ff', '規制': '#f0883e',
  'Apple': '#8b949e', 'CPI': '#f85149', 'カジュアル': '#56d364',
  'Google': '#56d364', 'パズル': '#388bfd', '事前登録': '#d2a8ff', '決算': '#e3b341',
  '広告': '#f0883e', '海外展開': '#79c0ff', 'ストア': '#8b949e',
  'アクション': '#f85149', 'シミュレーション': '#f0883e',
}

function formatTrendDate(dateStr) {
  const [, month, day] = dateStr.split('-')
  return day === '05' || day === '04' || day === '01' ? `${parseInt(month)}月` : ''
}

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 6, padding: '8px 12px', fontSize: 11 }}>
      <p style={{ color: '#8b949e', marginBottom: 4 }}>{label}</p>
      {payload.map(p => (
        <p key={p.dataKey || p.name} style={{ color: p.color ?? p.fill }}>
          {p.name}: <strong>{typeof p.value === 'number' ? (p.value < 20 && p.value !== Math.round(p.value) ? p.value : p.value.toFixed?.(1) ?? p.value) : p.value}{typeof p.value === 'number' && p.value < 20 && !p.dataKey?.includes('_MA') ? '%' : ''}</strong>
        </p>
      ))}
    </div>
  )
}

export default memo(function IndustryView({ data: indData, trendsData }) {
  const [tab, setTab] = useState('trends')

  const TABS = [
    { key: 'trends', label: 'トレンド' },
    { key: 'news', label: 'ニュース' },
    { key: 'cpi', label: 'CPI相場' },
    { key: 'retention', label: 'リテンション' },
    { key: 'market', label: '市場規模' },
  ]

  /* ---------- Macro / Trends ---------- */
  const GENRES = trendsData?._genres || Object.keys(trendsData?.weekly?.[0] || {}).filter(k => k !== 'date')
  const GENRE_TREND_COLORS = Object.fromEntries(GENRES.map((g, i) => [g, TREND_PALETTE[i % TREND_PALETTE.length]]))

  const [activeGenres, setActiveGenres] = useState(new Set(GENRES))
  const [showMA, setShowMA] = useState(false)

  function toggleGenre(genre) {
    setActiveGenres(prev => {
      const next = new Set(prev)
      next.has(genre) ? next.delete(genre) : next.add(genre)
      return next
    })
  }

  const weeklyData = trendsData?.weekly || []

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

  const latestTrend = weeklyData[weeklyData.length - 1]
  const prevTrend = weeklyData[weeklyData.length - 5]
  const topGenre = GENRES.length ? GENRES.reduce((a, b) => ((latestTrend?.[a] ?? 0) > (latestTrend?.[b] ?? 0) ? a : b)) : ''

  /* ---------- Industry Benchmarks ---------- */
  const bm = indData.benchmarks

  const cpiData = bm.cpi_by_genre.data.map(d => ({ genre: d.genre, iOS: d.ios, Android: d.android }))
  const retentionData = bm.retention_by_genre.data.map(d => ({ genre: d.genre, D1: d.d1, D7: d.d7, D30: d.d30 }))
  const shareData = bm.market_size.top_genre_share.map(d => ({ name: d.genre, value: d.share }))

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-header-left">
          <div className="panel-indicator industry-indicator" />
          <span className="panel-title industry-title">業界情報</span>
          <span className="panel-tag">無料公開データ</span>
        </div>
      </div>

      <div className="panel-body">
        <div className="fundamental-tabs">
          {TABS.map(t => (<button key={t.key} className={`fundamental-tab industry-tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>))}
        </div>

        {tab === 'trends' && trendsData && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div className="genre-legend" style={{ flex: 1 }}>
                {GENRES.map(genre => (
                  <button key={genre} className="legend-item" onClick={() => toggleGenre(genre)} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: activeGenres.has(genre) ? 1 : 0.35, padding: '2px 4px', borderRadius: 4 }}>
                    <span className="legend-dot" style={{ background: GENRE_TREND_COLORS[genre] }} />
                    <span style={{ color: activeGenres.has(genre) ? '#e6edf3' : '#6e7681', fontSize: 11 }}>{genre}</span>
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button onClick={() => setShowMA(v => !v)} className="macro-toggle-btn" style={{ borderColor: showMA ? 'rgba(56,139,253,0.5)' : '#30363d', background: showMA ? 'rgba(56,139,253,0.15)' : 'transparent', color: showMA ? '#388bfd' : '#6e7681' }}>MA4</button>
                <span style={{ fontSize: 9, color: '#6e7681' }}>Google Trends (JP)</span>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={trendChartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                <XAxis dataKey="date" tickFormatter={formatTrendDate} tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={{ stroke: '#30363d' }} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                {GENRES.map(genre => activeGenres.has(genre) && (
                  <Line key={genre} type="monotone" dataKey={genre} stroke={GENRE_TREND_COLORS[genre]} strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
                ))}
                {showMA && GENRES.map(genre => activeGenres.has(genre) && (
                  <Line key={`${genre}_MA`} type="monotone" dataKey={`${genre}_MA`} name={`${genre} MA4`} stroke={GENRE_TREND_COLORS[genre]} strokeWidth={1} strokeDasharray="4 3" dot={false} connectNulls />
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
                  <span key={genre} className="trend-badge" style={{ borderColor: `${GENRE_TREND_COLORS[genre]}44`, background: `${GENRE_TREND_COLORS[genre]}11` }}>
                    <span style={{ color: GENRE_TREND_COLORS[genre], fontWeight: 600 }}>{genre}</span>
                    <span style={{ color: TREND_COLORS[t.trend], fontSize: 10 }}>{TREND_ICONS[t.trend]} {TREND_LABELS[t.trend]}</span>
                    <span style={{ color: '#6e7681', fontSize: 10 }}>({t.pop4w > 0 ? '+' : ''}{t.pop4w}%)</span>
                  </span>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <div style={{ flex: 1, background: '#0d1117', borderRadius: 6, padding: '6px 10px', border: '1px solid #21262d' }}>
                <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 2 }}>最強ジャンル</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: GENRE_TREND_COLORS[topGenre] }}>
                  {topGenre}<span style={{ fontSize: 11, color: '#8b949e', marginLeft: 4 }}>({latestTrend?.[topGenre]})</span>
                </div>
              </div>
              {GENRES[0] && (
                <div style={{ flex: 1, background: '#0d1117', borderRadius: 6, padding: '6px 10px', border: '1px solid #21262d' }}>
                  <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 2 }}>{GENRES[0]} 4週トレンド</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: (latestTrend?.[GENRES[0]] ?? 0) >= (prevTrend?.[GENRES[0]] ?? 0) ? '#56d364' : '#f85149' }}>
                    {(latestTrend?.[GENRES[0]] ?? 0) >= (prevTrend?.[GENRES[0]] ?? 0) ? '▲' : '▼'}
                    {Math.abs((latestTrend?.[GENRES[0]] ?? 0) - (prevTrend?.[GENRES[0]] ?? 0))} pts
                  </div>
                </div>
              )}
              <div style={{ flex: 1, background: '#0d1117', borderRadius: 6, padding: '6px 10px', border: '1px solid #21262d' }}>
                <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 2 }}>異常検知</div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>
                  {anomalies.length > 0 ? <span style={{ color: '#f85149' }}>{anomalies.length}件検出</span> : <span style={{ color: '#56d364' }}>正常</span>}
                </div>
              </div>
            </div>
          </>
        )}

        {tab === 'news' && (
          <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {indData.news.map((item, i) => (
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

        {tab === 'cpi' && (
          <>
            <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 4 }}>ジャンル別 CPI (USD) — {bm.cpi_by_genre.period} 業界平均</div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={cpiData} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                <XAxis dataKey="genre" tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={{ stroke: '#30363d' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={false} tickLine={false} unit="$" />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="iOS" fill="#388bfd" name="iOS" />
                <Bar dataKey="Android" fill="#56d364" name="Android" />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {bm.cpi_by_genre.data.map(d => (
                <div key={d.genre} className="stat-card" style={{ minWidth: 70 }}>
                  <div style={{ fontSize: 9, color: GENRE_COLORS[d.genre] || '#8b949e' }}>{d.genre}</div>
                  <div style={{ fontSize: 11, color: '#e6edf3' }}>
                    ${d.ios}
                    <span style={{ fontSize: 9, marginLeft: 4, color: CPI_TREND_COLORS[d.trend] || '#6e7681' }}>{TREND_ICONS[d.trend] || ''}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'retention' && (
          <>
            <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 4 }}>ジャンル別 リテンション率 (%) — {bm.retention_by_genre.period} 業界平均</div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={retentionData} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                <XAxis dataKey="genre" tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={{ stroke: '#30363d' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="D1" fill="#56d364" name="D1" />
                <Bar dataKey="D7" fill="#e3b341" name="D7" />
                <Bar dataKey="D30" fill="#f85149" name="D30" />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <div className="stat-card"><div style={{ fontSize: 10, color: '#6e7681' }}>全ジャンル平均 D1</div><div style={{ fontSize: 14, fontWeight: 700, color: '#56d364' }}>{Math.round(bm.retention_by_genre.data.reduce((s, d) => s + d.d1, 0) / bm.retention_by_genre.data.length)}%</div></div>
              <div className="stat-card"><div style={{ fontSize: 10, color: '#6e7681' }}>全ジャンル平均 D7</div><div style={{ fontSize: 14, fontWeight: 700, color: '#e3b341' }}>{Math.round(bm.retention_by_genre.data.reduce((s, d) => s + d.d7, 0) / bm.retention_by_genre.data.length)}%</div></div>
              <div className="stat-card"><div style={{ fontSize: 10, color: '#6e7681' }}>全ジャンル平均 D30</div><div style={{ fontSize: 14, fontWeight: 700, color: '#f85149' }}>{Math.round(bm.retention_by_genre.data.reduce((s, d) => s + d.d30, 0) / bm.retention_by_genre.data.length)}%</div></div>
            </div>
          </>
        )}

        {tab === 'market' && (
          <>
            <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 4 }}>国内モバイルゲーム市場 ジャンル別シェア</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <ResponsiveContainer width="50%" height={160}>
                <PieChart>
                  <Pie data={shareData} cx="50%" cy="50%" innerRadius={35} outerRadius={65} dataKey="value" stroke="#161b22" strokeWidth={2}>
                    {shareData.map(d => (<Cell key={d.name} fill={GENRE_COLORS[d.name] ?? '#484f58'} />))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1 }}>
                {shareData.map(d => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: GENRE_COLORS[d.name] ?? '#484f58', flexShrink: 0 }} />
                    <span style={{ fontSize: 10, color: '#8b949e', flex: 1 }}>{d.name}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#e6edf3' }}>{d.value}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <div className="stat-card"><div style={{ fontSize: 10, color: '#6e7681' }}>市場規模 (2025)</div><div style={{ fontSize: 16, fontWeight: 700, color: '#388bfd' }}>{bm.market_size.jp_mobile_game_2025}</div></div>
              <div className="stat-card"><div style={{ fontSize: 10, color: '#6e7681' }}>前年比</div><div style={{ fontSize: 14, fontWeight: 700, color: '#56d364' }}>{bm.market_size.yoy_growth}</div></div>
              <div className="stat-card"><div style={{ fontSize: 10, color: '#6e7681' }}>出典</div><div style={{ fontSize: 10, color: '#8b949e' }}>JOGA / Unity Report</div></div>
            </div>
          </>
        )}
      </div>
      <div className="panel-footer">generated data — 実データ: pytrends / 4Gamer / GameBiz RSS + Unity Gaming Report</div>
    </div>
  )
})
