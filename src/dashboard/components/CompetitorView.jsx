import { useState } from 'react'
import adsData from '../../../data/mock/meta-ads.json'

const GENRE_FILTER_OPTIONS = ['全て', 'パズル', 'RPG', 'カジュアル', 'ストラテジー']
const STATUS_FILTER_OPTIONS = ['全て', 'active', 'inactive']

export default function CompetitorView() {
  const [genreFilter, setGenreFilter] = useState('全て')
  const [statusFilter, setStatusFilter] = useState('全て')

  const ads = adsData.ads.filter(ad => {
    const genreMatch = genreFilter === '全て' || ad.genre === genreFilter
    const statusMatch = statusFilter === '全て' || ad.status === statusFilter
    return genreMatch && statusMatch
  })

  // 広告主別の出稿数集計
  const advertiserCounts = adsData.ads.reduce((acc, ad) => {
    acc[ad.advertiser] = (acc[ad.advertiser] || 0) + 1
    return acc
  }, {})
  const topAdvertiser = Object.entries(advertiserCounts)
    .sort((a, b) => b[1] - a[1])[0]

  const activeCount = adsData.ads.filter(a => a.status === 'active').length

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-header-left">
          <div className="panel-indicator competitor-indicator" />
          <span className="panel-title competitor-title">競合</span>
          <span className="panel-tag">Meta広告ライブラリ</span>
        </div>
        <span className="panel-tag">出稿中 {activeCount}件</span>
      </div>

      <div className="panel-body">
        {/* フィルター */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: '#6e7681' }}>ジャンル:</span>
          {GENRE_FILTER_OPTIONS.map(opt => (
            <button
              key={opt}
              onClick={() => setGenreFilter(opt)}
              style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 4,
                border: '1px solid',
                borderColor: genreFilter === opt ? '#f85149' : '#30363d',
                background: genreFilter === opt ? 'rgba(248,81,73,0.15)' : 'transparent',
                color: genreFilter === opt ? '#f85149' : '#6e7681',
                cursor: 'pointer',
              }}
            >
              {opt}
            </button>
          ))}
          <span style={{ fontSize: 10, color: '#6e7681', marginLeft: 4 }}>状態:</span>
          {STATUS_FILTER_OPTIONS.map(opt => (
            <button
              key={opt}
              onClick={() => setStatusFilter(opt)}
              style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 4,
                border: '1px solid',
                borderColor: statusFilter === opt ? '#f85149' : '#30363d',
                background: statusFilter === opt ? 'rgba(248,81,73,0.15)' : 'transparent',
                color: statusFilter === opt ? '#f85149' : '#6e7681',
                cursor: 'pointer',
              }}
            >
              {opt}
            </button>
          ))}
        </div>

        {/* テーブル */}
        <div style={{ overflowX: 'auto', maxHeight: 220, overflowY: 'auto' }}>
          <table className="ads-table">
            <thead>
              <tr>
                <th>広告主</th>
                <th>タイトル</th>
                <th>フォーマット</th>
                <th>リーチ</th>
                <th>クリエイティブ</th>
                <th>状態</th>
                <th>開始日</th>
              </tr>
            </thead>
            <tbody>
              {ads.map(ad => (
                <tr key={ad.id}>
                  <td style={{ color: '#e6edf3', fontWeight: 500 }}>{ad.advertiser}</td>
                  <td style={{ color: '#8b949e' }}>{ad.title}</td>
                  <td><span className="format-badge">{ad.format}</span></td>
                  <td>
                    <span className={`reach-${ad.reach_estimate}`}>{ad.reach_estimate}</span>
                  </td>
                  <td style={{ color: '#6e7681', maxWidth: 140 }}>{ad.creative_hook}</td>
                  <td>
                    <span className={`status-badge status-${ad.status}`}>
                      {ad.status === 'active' ? '出稿中' : '停止'}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'monospace', color: '#6e7681' }}>
                    {ad.started.slice(5)}
                  </td>
                </tr>
              ))}
              {ads.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: '#6e7681', padding: 20 }}>
                    該当なし
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 広告主サマリー */}
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <div style={{
            flex: 1, background: '#0d1117', borderRadius: 6,
            padding: '6px 10px', border: '1px solid #21262d',
          }}>
            <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 2 }}>最多出稿</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#f85149' }}>
              {topAdvertiser[0]}
              <span style={{ fontSize: 11, color: '#8b949e', marginLeft: 4 }}>
                {topAdvertiser[1]}件
              </span>
            </div>
          </div>
          {Object.entries(advertiserCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([adv, cnt]) => (
              <div key={adv} style={{
                flex: 1, background: '#0d1117', borderRadius: 6,
                padding: '6px 10px', border: '1px solid #21262d',
              }}>
                <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 2 }}>{adv}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#e6edf3' }}>{cnt}件</div>
              </div>
            ))
          }
        </div>
      </div>

      <div className="panel-footer">
        mock data — 実API接続時: Meta Ad Library API (公開)
      </div>
    </div>
  )
}
