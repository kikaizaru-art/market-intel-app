import { useState, useMemo, memo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'

const GENRE_COLORS = {
  'パズル': '#388bfd', 'RPG': '#d2a8ff',
  'カジュアル': '#56d364', 'ストラテジー': '#e3b341',
  'アクション': '#f85149', 'シミュレーション': '#79c0ff',
}

const REACH_ORDER = { '高': 0, '中': 1, '低': 2 }

const ChartTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 6, padding: '8px 12px', fontSize: 11 }}>
      <p style={{ color: '#e6edf3', fontWeight: 600 }}>{d.name}</p>
      <p style={{ color: '#8b949e' }}>出稿数: <strong style={{ color: '#f85149' }}>{d.count}件</strong></p>
      <p style={{ color: '#6e7681' }}>稼働中: {d.active}件 / 停止: {d.inactive}件</p>
    </div>
  )
}

export default memo(function CompetitorView({ data: adsData }) {
  const [genreFilter, setGenreFilter] = useState('全て')
  const [statusFilter, setStatusFilter] = useState('全て')
  const [sortKey, setSortKey] = useState('started')
  const [sortAsc, setSortAsc] = useState(false)
  const [viewMode, setViewMode] = useState('table')

  const genreOptions = useMemo(() => {
    const genres = new Set(adsData.ads.map(a => a.genre))
    return ['全て', ...genres]
  }, [adsData])

  const ads = useMemo(() => {
    const filtered = adsData.ads.filter(ad => {
      const genreMatch = genreFilter === '全て' || ad.genre === genreFilter
      const statusMatch = statusFilter === '全て' || ad.status === statusFilter
      return genreMatch && statusMatch
    })
    return [...filtered].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'reach_estimate') {
        cmp = (REACH_ORDER[a.reach_estimate] ?? 3) - (REACH_ORDER[b.reach_estimate] ?? 3)
      } else {
        cmp = (a[sortKey] ?? '').localeCompare(b[sortKey] ?? '')
      }
      return sortAsc ? cmp : -cmp
    })
  }, [adsData, genreFilter, statusFilter, sortKey, sortAsc])

  const advertiserCounts = useMemo(() => adsData.ads.reduce((acc, ad) => {
    acc[ad.advertiser] = (acc[ad.advertiser] || 0) + 1
    return acc
  }, {}), [adsData])
  const topAdvertiser = Object.entries(advertiserCounts).sort((a, b) => b[1] - a[1])[0] || ['–', 0]
  const activeCount = adsData.ads.filter(a => a.status === 'active').length

  const barData = useMemo(() => {
    const map = {}
    for (const ad of adsData.ads) {
      if (!map[ad.advertiser]) map[ad.advertiser] = { name: ad.advertiser, count: 0, active: 0, inactive: 0 }
      map[ad.advertiser].count++
      map[ad.advertiser][ad.status]++
    }
    return Object.values(map).sort((a, b) => b.count - a.count)
  }, [adsData])

  const genreHeatmap = useMemo(() => {
    const advertisers = [...new Set(adsData.ads.map(a => a.advertiser))]
    const genres = [...new Set(adsData.ads.map(a => a.genre))]
    return { advertisers, genres, data: advertisers.map(adv => {
      const row = { advertiser: adv }
      for (const g of genres) row[g] = adsData.ads.filter(a => a.advertiser === adv && a.genre === g).length
      return row
    })}
  }, [adsData])

  const SORT_OPTIONS = [
    { key: 'started', label: '開始日' },
    { key: 'advertiser', label: '広告主' },
    { key: 'reach_estimate', label: 'リーチ' },
  ]

  function handleSort(key) {
    if (sortKey === key) setSortAsc(v => !v)
    else { setSortKey(key); setSortAsc(true) }
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-header-left">
          <div className="panel-indicator competitor-indicator" />
          <span className="panel-title competitor-title">競合</span>
          <span className="panel-tag">Meta広告ライブラリ</span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div className="view-toggle">
            <button className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`} onClick={() => setViewMode('table')}>表</button>
            <button className={`view-toggle-btn ${viewMode === 'chart' ? 'active' : ''}`} onClick={() => setViewMode('chart')}>図</button>
          </div>
          <span className="panel-tag">出稿中 {activeCount}件</span>
        </div>
      </div>

      <div className="panel-body">
        {viewMode === 'table' ? (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, color: '#6e7681' }}>ジャンル:</span>
              {genreOptions.map(opt => (
                <button key={opt} onClick={() => setGenreFilter(opt)} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, border: '1px solid', borderColor: genreFilter === opt ? '#f85149' : '#30363d', background: genreFilter === opt ? 'rgba(248,81,73,0.15)' : 'transparent', color: genreFilter === opt ? '#f85149' : '#6e7681', cursor: 'pointer' }}>{opt}</button>
              ))}
              <span style={{ fontSize: 10, color: '#6e7681', marginLeft: 4 }}>状態:</span>
              {['全て', 'active', 'inactive'].map(opt => (
                <button key={opt} onClick={() => setStatusFilter(opt)} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, border: '1px solid', borderColor: statusFilter === opt ? '#f85149' : '#30363d', background: statusFilter === opt ? 'rgba(248,81,73,0.15)' : 'transparent', color: statusFilter === opt ? '#f85149' : '#6e7681', cursor: 'pointer' }}>{opt}</button>
              ))}
            </div>
            <div style={{ overflowX: 'auto', maxHeight: 200, overflowY: 'auto' }}>
              <table className="ads-table">
                <thead><tr>
                  {SORT_OPTIONS.map(({ key, label }) => (<th key={key} onClick={() => handleSort(key)} style={{ cursor: 'pointer', userSelect: 'none' }}>{label} {sortKey === key ? (sortAsc ? '▲' : '▼') : ''}</th>))}
                  <th>タイトル</th><th>フォーマット</th><th>クリエイティブ</th><th>状態</th>
                </tr></thead>
                <tbody>
                  {ads.map(ad => (
                    <tr key={ad.id}>
                      <td style={{ fontFamily: 'monospace', color: '#6e7681' }}>{ad.started.slice(5)}</td>
                      <td style={{ color: '#e6edf3', fontWeight: 500 }}>{ad.advertiser}</td>
                      <td><span className={`reach-${ad.reach_estimate}`}>{ad.reach_estimate}</span></td>
                      <td style={{ color: '#8b949e' }}>{ad.title}</td>
                      <td><span className="format-badge">{ad.format}</span></td>
                      <td style={{ color: '#6e7681', maxWidth: 140 }}>{ad.creative_hook}</td>
                      <td><span className={`status-badge status-${ad.status}`}>{ad.status === 'active' ? '出稿中' : '停止'}</span></td>
                    </tr>
                  ))}
                  {ads.length === 0 && (<tr><td colSpan={7} style={{ textAlign: 'center', color: '#6e7681', padding: 20 }}>該当なし</td></tr>)}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 6 }}>広告主別 出稿数 (稼働中/停止)</div>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={barData} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#8b949e' }} axisLine={false} tickLine={false} width={58} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="active" stackId="a" fill="#56d364" name="稼働中" />
                <Bar dataKey="inactive" stackId="a" fill="#484f58" name="停止" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 8 }}>
              <div className="stat-card">
                <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 4 }}>リーチ分布</div>
                {['高', '中', '低'].map(r => {
                  const cnt = adsData.ads.filter(a => a.reach_estimate === r).length
                  const pct = adsData.ads.length > 0 ? Math.round(cnt / adsData.ads.length * 100) : 0
                  return (
                    <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                      <span className={`reach-${r}`} style={{ fontSize: 10, minWidth: 14 }}>{r}</span>
                      <div style={{ flex: 1, height: 4, background: '#21262d', borderRadius: 2 }}>
                        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 2, background: r === '高' ? '#f85149' : r === '中' ? '#e3b341' : '#484f58' }} />
                      </div>
                      <span style={{ fontSize: 9, color: '#6e7681', minWidth: 20 }}>{cnt}件</span>
                    </div>
                  )
                })}
              </div>
              <div className="stat-card">
                <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 4 }}>プラットフォーム</div>
                {(() => {
                  const platforms = {}
                  adsData.ads.forEach(a => a.platforms.forEach(p => { platforms[p] = (platforms[p] || 0) + 1 }))
                  return Object.entries(platforms).sort((a, b) => b[1] - a[1]).map(([p, cnt]) => (
                    <div key={p} style={{ fontSize: 10, color: '#8b949e', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{p}</span><span style={{ color: '#e6edf3', fontWeight: 600 }}>{cnt}</span>
                    </div>
                  ))
                })()}
              </div>
            </div>
            <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 6 }}>ジャンル × 広告主 マトリクス</div>
            <div className="heatmap-grid">
              <div className="heatmap-row heatmap-header-row">
                <div className="heatmap-cell heatmap-label" />
                {genreHeatmap.genres.map(g => (<div key={g} className="heatmap-cell heatmap-col-header" style={{ color: GENRE_COLORS[g] || '#8b949e' }}>{g}</div>))}
              </div>
              {genreHeatmap.data.map(row => (
                <div key={row.advertiser} className="heatmap-row">
                  <div className="heatmap-cell heatmap-label">{row.advertiser}</div>
                  {genreHeatmap.genres.map(g => (
                    <div key={g} className="heatmap-cell" style={{ background: row[g] > 0 ? `rgba(248, 81, 73, ${Math.min(row[g] * 0.25, 0.8)})` : 'rgba(110,118,129,0.08)', color: row[g] > 0 ? '#e6edf3' : '#484f58', fontWeight: row[g] > 0 ? 600 : 400 }}>{row[g]}</div>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <div style={{ flex: 1, background: '#0d1117', borderRadius: 6, padding: '6px 10px', border: '1px solid #21262d' }}>
            <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 2 }}>最多出稿</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#f85149' }}>{topAdvertiser[0]}<span style={{ fontSize: 11, color: '#8b949e', marginLeft: 4 }}>{topAdvertiser[1]}件</span></div>
          </div>
          <div style={{ flex: 1, background: '#0d1117', borderRadius: 6, padding: '6px 10px', border: '1px solid #21262d' }}>
            <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 2 }}>動画比率</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#e6edf3' }}>{adsData.ads.length > 0 ? Math.round(adsData.ads.filter(a => a.format === '動画').length / adsData.ads.length * 100) : 0}%</div>
          </div>
          <div style={{ flex: 1, background: '#0d1117', borderRadius: 6, padding: '6px 10px', border: '1px solid #21262d' }}>
            <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 2 }}>稼働率</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#56d364' }}>{adsData.ads.length > 0 ? Math.round(activeCount / adsData.ads.length * 100) : 0}%</div>
          </div>
        </div>
      </div>
      <div className="panel-footer">generated data — 実API接続時: Meta Ad Library API (公開)</div>
    </div>
  )
})
