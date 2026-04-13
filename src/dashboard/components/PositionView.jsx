import { useMemo, memo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { ChartTooltip, SentimentBar, ImpactDot } from './shared/index.js'
import {
  PALETTE, IMPACT_LABELS, IMPACT_COLORS,
  TREND_LABELS, TREND_ICONS, TREND_COLORS,
} from '../constants.js'
import { formatDate } from '../utils.js'
import { calcGenreTrends } from '../../analyzers/trend.js'

/**
 * 現在地タブ — 対象の今のポジションを一画面で把握
 *
 * - KPIスコアカード（レビュー/ランキング/センチメント/トレンド）
 * - 競合ポジション（ランキング比較）
 * - マクロ環境（追い風/逆風インジケータ）
 * - ユーザーの声（好評/不満）
 */
export default memo(function PositionView({
  target,
  reviews,
  fundamentals,
  trends,
  industry,
  corporate,
  events,
  causation,
}) {
  // ─── 対象アプリの基本指標 ───────────────────────
  const targetReview = useMemo(() =>
    reviews?.apps?.find(a => a.id === 'target'), [reviews])

  const targetFundamental = useMemo(() =>
    fundamentals?.apps?.find(a => a.id === 'target'), [fundamentals])

  const latestReview = targetReview?.monthly[targetReview.monthly.length - 1]
  const prevReview = targetReview?.monthly[targetReview.monthly.length - 2]
  const scoreDiff = latestReview && prevReview ? (latestReview.score - prevReview.score).toFixed(1) : '0.0'
  const totalReviews = targetReview?.monthly.reduce((s, m) => s + m.count, 0) || 0

  const latestRank = targetFundamental?.weekly_sales_rank[targetFundamental.weekly_sales_rank.length - 1]?.rank
  const prevRank = targetFundamental?.weekly_sales_rank[targetFundamental.weekly_sales_rank.length - 5]?.rank
  const rankDiff = latestRank && prevRank ? prevRank - latestRank : 0

  // ─── 競合ランキング ──────────────────────────────
  const APP_COLORS = useMemo(() =>
    Object.fromEntries((fundamentals?.apps || []).map((a, i) => [a.id, PALETTE[i % PALETTE.length]])),
    [fundamentals?.apps])

  const rankSummary = useMemo(() =>
    (fundamentals?.apps || []).map(app => {
      const ranks = app.weekly_sales_rank
      const latest = ranks[ranks.length - 1]?.rank ?? 0
      const prev = ranks[ranks.length - 5]?.rank ?? latest
      return { name: app.name, id: app.id, latest, diff: prev - latest }
    }), [fundamentals?.apps])

  // ─── マクロ環境 ──────────────────────────────────
  const GENRES = trends?._genres || Object.keys(trends?.weekly?.[0] || {}).filter(k => k !== 'date')
  const GENRE_COLORS = useMemo(() =>
    Object.fromEntries(GENRES.map((g, i) => [g, PALETTE[i % PALETTE.length]])),
    [GENRES])

  const weeklyData = trends?.weekly || []
  const genreTrends = useMemo(() =>
    weeklyData.length ? calcGenreTrends(weeklyData, GENRES) : {},
    [weeklyData, GENRES])

  const headwinds = useMemo(() =>
    Object.entries(genreTrends).filter(([, t]) => t.trend === 'rising'),
    [genreTrends])
  const tailwinds = useMemo(() =>
    Object.entries(genreTrends).filter(([, t]) => t.trend === 'falling'),
    [genreTrends])

  // ─── ユーザーの声 ─────────────────────────────────
  const apps = reviews?.apps || []
  const appSummaries = useMemo(() =>
    apps.map((app, i) => {
      const latest = app.monthly[app.monthly.length - 1]
      const prev = app.monthly[app.monthly.length - 2]
      return {
        id: app.id, name: app.name,
        score: latest?.score ?? 0,
        diff: prev ? (latest.score - prev.score).toFixed(1) : '0.0',
        sentiment: latest?.positive_ratio ?? 0,
        color: PALETTE[i % PALETTE.length],
      }
    }), [apps])

  // ─── 因果サマリー ─────────────────────────────────
  const notes = causation?.notes || []
  const recentNotes = useMemo(() =>
    [...notes].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3),
    [notes])

  // ─── SNSバズ ──────────────────────────────────────
  const snsMonthly = fundamentals?.sns_buzz?.monthly || []
  const latestSns = snsMonthly[snsMonthly.length - 1]
  const prevSns = snsMonthly[snsMonthly.length - 2]

  // ─── ミニランキングチャート ─────────────────────────
  const recentRankData = useMemo(() => {
    if (!fundamentals?.apps?.length) return []
    const apps = fundamentals.apps
    const dates = apps[0].weekly_sales_rank.slice(-8)
    return dates.map((d, i) => {
      const idx = apps[0].weekly_sales_rank.length - 8 + i
      const row = { date: d.date }
      for (const app of apps) {
        row[app.name] = app.weekly_sales_rank[idx]?.rank
      }
      return row
    })
  }, [fundamentals?.apps])

  // ─── 企業スナップショット ──────────────────────────
  const targetCompany = corporate?.companies?.[0]
  const latestQ = targetCompany?.quarterly_financials[targetCompany.quarterly_financials.length - 1]

  return (
    <>
      {/* ━━━ KPI スコアカード ━━━ */}
      <div className="panel position-panel" style={{ gridColumn: '1 / -1' }}>
        <div className="panel-header">
          <div className="panel-header-left">
            <div className="panel-indicator position-indicator" />
            <span className="panel-title position-title">{target.appName}</span>
            <span className="panel-tag">現在のポジション</span>
          </div>
        </div>
        <div className="panel-body">
          <div className="position-kpi-grid">
            <div className="stat-card">
              <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 2 }}>レビュースコア</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: '#e3b341' }}>★ {latestReview?.score ?? '—'}</span>
                {parseFloat(scoreDiff) !== 0 && (
                  <span style={{ fontSize: 12, fontWeight: 600, color: parseFloat(scoreDiff) >= 0 ? '#56d364' : '#f85149' }}>
                    {parseFloat(scoreDiff) >= 0 ? '▲' : '▼'}{Math.abs(scoreDiff)}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 10, color: '#6e7681' }}>累計 {totalReviews.toLocaleString()}件</div>
            </div>

            <div className="stat-card">
              <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 2 }}>セールスランク</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: '#388bfd' }}>{latestRank ?? '—'}<span style={{ fontSize: 12 }}>位</span></span>
                {rankDiff !== 0 && (
                  <span style={{ fontSize: 12, fontWeight: 600, color: rankDiff > 0 ? '#56d364' : '#f85149' }}>
                    {rankDiff > 0 ? `▲${rankDiff}` : `▼${Math.abs(rankDiff)}`}
                  </span>
                )}
              </div>
            </div>

            <div className="stat-card">
              <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 2 }}>ユーザーセンチメント</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: (latestReview?.positive_ratio ?? 0) >= 0.7 ? '#56d364' : (latestReview?.positive_ratio ?? 0) >= 0.5 ? '#e3b341' : '#f85149' }}>
                好意的 {latestReview ? Math.round(latestReview.positive_ratio * 100) : '—'}%
              </div>
              {latestReview && <SentimentBar ratio={latestReview.positive_ratio} color="#56d364" />}
            </div>

            <div className="stat-card">
              <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 2 }}>市場環境</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {headwinds.length > 0 && (
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: 'rgba(86,211,100,0.12)', color: '#56d364', border: '1px solid rgba(86,211,100,0.3)' }}>
                    追い風 {headwinds.length}
                  </span>
                )}
                {tailwinds.length > 0 && (
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: 'rgba(248,81,73,0.12)', color: '#f85149', border: '1px solid rgba(248,81,73,0.3)' }}>
                    逆風 {tailwinds.length}
                  </span>
                )}
                {headwinds.length === 0 && tailwinds.length === 0 && (
                  <span style={{ fontSize: 10, color: '#6e7681' }}>安定</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ━━━ 競合ポジション ━━━ */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-header-left">
            <div className="panel-indicator" style={{ background: '#f0883e' }} />
            <span className="panel-title" style={{ color: '#f0883e' }}>競合ポジション</span>
            <span className="panel-tag">ランキング比較</span>
          </div>
        </div>
        <div className="panel-body">
          {recentRankData.length > 0 && (
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={recentRankData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 9, fill: '#6e7681' }} axisLine={{ stroke: '#30363d' }} tickLine={false} />
                <YAxis reversed domain={[1, 100]} tick={{ fontSize: 9, fill: '#6e7681' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                {(fundamentals?.apps || []).map(app => (
                  <Line key={app.id} type="monotone" dataKey={app.name} stroke={APP_COLORS[app.id]} strokeWidth={1.5} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 4, marginTop: 8 }}>
            {rankSummary.map(app => (
              <div key={app.id} className="stat-card" style={{ padding: '4px 6px' }}>
                <div style={{ fontSize: 8, color: APP_COLORS[app.id], fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.name}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#e6edf3' }}>{app.latest}位</span>
                  <span style={{ fontSize: 9, color: app.diff > 0 ? '#56d364' : app.diff < 0 ? '#f85149' : '#6e7681' }}>
                    {app.diff > 0 ? `▲${app.diff}` : app.diff < 0 ? `▼${Math.abs(app.diff)}` : '→'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="panel-footer">セールスランキング直近推移</div>
      </div>

      {/* ━━━ ユーザーの声 ━━━ */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-header-left">
            <div className="panel-indicator user-indicator" />
            <span className="panel-title user-title">ユーザーの声</span>
            <span className="panel-tag">レビュー分析</span>
          </div>
        </div>
        <div className="panel-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 220, overflowY: 'auto' }}>
            {appSummaries.map(app => (
              <div key={app.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', borderBottom: '1px solid #21262d' }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: app.color, minWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.name}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#e6edf3' }}>★{app.score}</span>
                <span style={{ fontSize: 9, color: parseFloat(app.diff) >= 0 ? '#56d364' : '#f85149' }}>
                  {parseFloat(app.diff) >= 0 ? '▲' : '▼'}{Math.abs(app.diff)}
                </span>
                <div style={{ flex: 1 }}>
                  <SentimentBar ratio={app.sentiment} color={app.color} />
                </div>
              </div>
            ))}
          </div>
          {targetReview && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 4 }}>主な不満</div>
                {targetReview.top_complaints.map(c => (<span key={c} className="complaint-tag">{c}</span>))}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 4 }}>主な好評点</div>
                {targetReview.top_praises.map(p => (<span key={p} className="praise-tag">{p}</span>))}
              </div>
            </div>
          )}
        </div>
        <div className="panel-footer">ストアレビュー + SNSセンチメント</div>
      </div>

      {/* ━━━ マクロ環境 ━━━ */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-header-left">
            <div className="panel-indicator macro-indicator" />
            <span className="panel-title macro-title">マクロ環境</span>
            <span className="panel-tag">追い風 / 逆風</span>
          </div>
        </div>
        <div className="panel-body">
          <div className="trend-badges" style={{ marginTop: 0 }}>
            {GENRES.map(genre => {
              const t = genreTrends[genre]
              if (!t) return null
              return (
                <span key={genre} className="trend-badge" style={{ borderColor: `${GENRE_COLORS[genre]}44`, background: `${GENRE_COLORS[genre]}11` }}>
                  <span style={{ color: GENRE_COLORS[genre], fontWeight: 600 }}>{genre}</span>
                  <span style={{ color: TREND_COLORS[t.trend], fontSize: 10 }}>{TREND_ICONS[t.trend]} {TREND_LABELS[t.trend]}</span>
                  <span style={{ color: '#6e7681', fontSize: 10 }}>({t.pop4w > 0 ? '+' : ''}{t.pop4w}%)</span>
                </span>
              )
            })}
          </div>

          {latestSns && prevSns && (
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #21262d' }}>
              <div style={{ fontSize: 10, color: '#388bfd', fontWeight: 600, marginBottom: 6 }}>SNSバズ</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <div className="stat-card">
                  <div style={{ fontSize: 9, color: '#6e7681' }}>X投稿数</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#388bfd' }}>
                    {latestSns.twitter_mentions.toLocaleString()}
                    <span style={{ fontSize: 9, marginLeft: 3, color: latestSns.twitter_mentions > prevSns.twitter_mentions ? '#56d364' : '#f85149' }}>
                      {latestSns.twitter_mentions > prevSns.twitter_mentions ? '▲' : '▼'}
                    </span>
                  </div>
                </div>
                <div className="stat-card">
                  <div style={{ fontSize: 9, color: '#6e7681' }}>YouTube</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#f85149' }}>{latestSns.youtube_videos}本</div>
                </div>
                <div className="stat-card">
                  <div style={{ fontSize: 9, color: '#6e7681' }}>配信者</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#56d364' }}>{latestSns.streamer_count}人</div>
                </div>
              </div>
            </div>
          )}

          {latestQ && (
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #21262d' }}>
              <div style={{ fontSize: 10, color: '#79c0ff', fontWeight: 600, marginBottom: 6 }}>{targetCompany?.name} 直近決算</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <div className="stat-card">
                  <div style={{ fontSize: 9, color: '#6e7681' }}>売上 ({latestQ.quarter})</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#79c0ff' }}>{latestQ.revenue_b}億</div>
                </div>
                <div className="stat-card">
                  <div style={{ fontSize: 9, color: '#6e7681' }}>営業利益率</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#e3b341' }}>{latestQ.op_margin}%</div>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="panel-footer">検索トレンド + SNS + 企業情報</div>
      </div>

      {/* ━━━ 直近の因果メモ ━━━ */}
      <div className="panel" style={{ gridColumn: '1 / -1' }}>
        <div className="panel-header">
          <div className="panel-header-left">
            <div className="panel-indicator causation-indicator" />
            <span className="panel-title causation-title">直近の因果メモ</span>
            <span className="panel-tag">{notes.length}件 蓄積</span>
          </div>
        </div>
        <div className="panel-body">
          {recentNotes.length > 0 ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {recentNotes.map(note => (
                <div key={note.id} className={`note-card ${note.impact}`} style={{ flex: '1 1 200px' }}>
                  <div className="note-header">
                    <span className="note-date">{note.date.slice(5)}</span>
                    <span className={`note-layer-badge layer-${note.layer}`}>{note.layer}</span>
                    <ImpactDot impact={note.impact} />
                    <span style={{ fontSize: 9, color: '#6e7681' }}>{IMPACT_LABELS[note.impact]}</span>
                  </div>
                  <div className="note-event">{note.event}</div>
                  {note.memo && <div className="note-memo">{note.memo}</div>}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: '#6e7681', textAlign: 'center', padding: 12 }}>
              因果メモはまだありません — 「次の一手」タブで蓄積が始まります
            </div>
          )}
        </div>
        <div className="panel-footer">詳細は「次の一手」タブで確認・入力</div>
      </div>
    </>
  )
})
