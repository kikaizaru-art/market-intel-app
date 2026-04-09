import { useState, memo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'

const GENRE_COLORS = {
  'パズル': '#388bfd', 'RPG': '#d2a8ff', 'カジュアル': '#56d364',
  'ストラテジー': '#e3b341', 'スポーツ': '#79c0ff', 'アクション': '#f85149',
  'シミュレーション': '#f0883e', 'その他': '#484f58',
}

const TREND_ICONS = { rising: '▲', falling: '▼', stable: '→' }
const TREND_COLORS = { rising: '#f85149', falling: '#56d364', stable: '#e3b341' }

const TAG_COLORS = {
  '市場動向': '#388bfd', 'RPG': '#d2a8ff', '競合': '#f85149',
  'ストラテジー': '#e3b341', 'ランキング': '#79c0ff', '規制': '#f0883e',
  'Apple': '#8b949e', 'CPI': '#f85149', 'カジュアル': '#56d364',
  'Google': '#56d364', 'パズル': '#388bfd', '事前登録': '#d2a8ff', '決算': '#e3b341',
  '広告': '#f0883e', '海外展開': '#79c0ff', 'ストア': '#8b949e',
  'アクション': '#f85149', 'シミュレーション': '#f0883e',
}

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 6, padding: '8px 12px', fontSize: 11 }}>
      <p style={{ color: '#8b949e', marginBottom: 4 }}>{label}</p>
      {payload.map(p => (
        <p key={p.dataKey || p.name} style={{ color: p.color ?? p.fill }}>
          {p.name}: <strong>{p.value}{typeof p.value === 'number' && p.value < 20 ? '%' : ''}</strong>
        </p>
      ))}
    </div>
  )
}

export default memo(function IndustryView({ data: indData }) {
  const [tab, setTab] = useState('news')

  const TABS = [
    { key: 'news', label: 'ニュース' },
    { key: 'cpi', label: 'CPI相場' },
    { key: 'retention', label: 'リテンション' },
    { key: 'market', label: '市場規模' },
  ]

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

        {tab === 'news' && (
          <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {indData.news.map((item, i) => (
              <div key={i} className="news-item">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span style={{ fontSize: 10, color: '#6e7681', fontFamily: 'monospace' }}>{item.date}</span>
                  <span className="news-source-badge">{item.source}</span>
                </div>
                <div style={{ fontSize: 11, color: '#e6edf3', lineHeight: 1.4, marginBottom: 4 }}>{item.title}</div>
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
                    <span style={{ fontSize: 9, marginLeft: 4, color: TREND_COLORS[d.trend] || '#6e7681' }}>{TREND_ICONS[d.trend] || ''}</span>
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
      <div className="panel-footer">generated data — 実データ: 4Gamer / GameBiz RSS + Unity Gaming Report</div>
    </div>
  )
})
