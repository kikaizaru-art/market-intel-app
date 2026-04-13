import { useMemo, memo } from 'react'
import CausationView from './CausationView.jsx'
import { detectAllAnomalies } from '../../analyzers/anomaly.js'
import { calcGenreTrends } from '../../analyzers/trend.js'
import { PALETTE, TREND_ICONS, TREND_COLORS } from '../constants.js'

/**
 * 次の一手タブ — 蓄積された因果パターンから行動を導く
 *
 * - リスク/チャンス サマリーカード
 * - 因果関係パネル（CausationView をフル表示）
 */
export default memo(function ActionsView({
  causation,
  trends,
  reviews,
  events,
  industry,
}) {
  // ─── リスク・チャンス検出 ──────────────────────────
  const GENRES = trends?._genres || Object.keys(trends?.weekly?.[0] || {}).filter(k => k !== 'date')
  const weeklyData = trends?.weekly || []

  const anomalies = useMemo(() =>
    weeklyData.length ? detectAllAnomalies(weeklyData, GENRES) : [],
    [weeklyData, GENRES])

  const genreTrends = useMemo(() =>
    weeklyData.length ? calcGenreTrends(weeklyData, GENRES) : {},
    [weeklyData, GENRES])

  const GENRE_COLORS = useMemo(() =>
    Object.fromEntries(GENRES.map((g, i) => [g, PALETTE[i % PALETTE.length]])),
    [GENRES])

  // 上昇トレンドをチャンス、下降トレンドをリスクとして抽出
  const opportunities = useMemo(() =>
    Object.entries(genreTrends)
      .filter(([, t]) => t.trend === 'rising')
      .map(([genre, t]) => ({ genre, ...t })),
    [genreTrends])

  const risks = useMemo(() => {
    const trendRisks = Object.entries(genreTrends)
      .filter(([, t]) => t.trend === 'falling')
      .map(([genre, t]) => ({ type: 'trend', genre, ...t }))
    const anomalyRisks = anomalies
      .filter(a => a.type === 'drop')
      .map(a => ({ type: 'anomaly', genre: a.genre, date: a.date, value: a.value }))
    return [...trendRisks, ...anomalyRisks]
  }, [genreTrends, anomalies])

  // レビュー急落リスク
  const reviewRisks = useMemo(() => {
    const apps = reviews?.apps || []
    return apps
      .map(app => {
        const latest = app.monthly[app.monthly.length - 1]
        const prev = app.monthly[app.monthly.length - 2]
        if (!latest || !prev) return null
        const diff = latest.score - prev.score
        if (diff < -0.3) return { name: app.name, score: latest.score, diff: diff.toFixed(1) }
        return null
      })
      .filter(Boolean)
  }, [reviews?.apps])

  return (
    <>
      {/* ━━━ リスク・チャンス サマリー ━━━ */}
      <div className="panel" style={{ gridColumn: '1 / -1' }}>
        <div className="panel-header">
          <div className="panel-header-left">
            <div className="panel-indicator actions-indicator" />
            <span className="panel-title actions-title">状況サマリー</span>
            <span className="panel-tag">リスク・チャンス</span>
          </div>
        </div>
        <div className="panel-body">
          <div style={{ display: 'flex', gap: 12 }}>
            {/* チャンス */}
            <div style={{ flex: 1, background: 'rgba(86,211,100,0.05)', borderRadius: 8, border: '1px solid rgba(86,211,100,0.2)', padding: '10px 12px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#56d364', marginBottom: 8 }}>
                チャンス
              </div>
              {opportunities.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {opportunities.map(o => (
                    <div key={o.genre} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                      <span style={{ color: GENRE_COLORS[o.genre], fontWeight: 600 }}>{o.genre}</span>
                      <span style={{ color: TREND_COLORS.rising }}>{TREND_ICONS.rising} +{o.pop4w}%</span>
                      <span style={{ color: '#6e7681', fontSize: 10 }}>上昇トレンド</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 10, color: '#6e7681' }}>現在検出されたチャンスはありません</div>
              )}
            </div>

            {/* リスク */}
            <div style={{ flex: 1, background: 'rgba(248,81,73,0.05)', borderRadius: 8, border: '1px solid rgba(248,81,73,0.2)', padding: '10px 12px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#f85149', marginBottom: 8 }}>
                リスク
              </div>
              {(risks.length > 0 || reviewRisks.length > 0) ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {risks.filter(r => r.type === 'trend').map(r => (
                    <div key={r.genre} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                      <span style={{ color: GENRE_COLORS[r.genre], fontWeight: 600 }}>{r.genre}</span>
                      <span style={{ color: TREND_COLORS.falling }}>{TREND_ICONS.falling} {r.pop4w}%</span>
                      <span style={{ color: '#6e7681', fontSize: 10 }}>下降トレンド</span>
                    </div>
                  ))}
                  {reviewRisks.map(r => (
                    <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                      <span style={{ color: '#d2a8ff', fontWeight: 600 }}>{r.name}</span>
                      <span style={{ color: '#f85149' }}>★ {r.score} ({r.diff})</span>
                      <span style={{ color: '#6e7681', fontSize: 10 }}>レビュー急落</span>
                    </div>
                  ))}
                  {anomalies.filter(a => a.type === 'drop').length > 0 && (
                    <div style={{ fontSize: 10, color: '#f85149', marginTop: 2 }}>
                      異常値検出: {anomalies.filter(a => a.type === 'drop').length}件
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: 10, color: '#6e7681' }}>現在検出されたリスクはありません</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ━━━ 因果関係パネル（既存CausationView） ━━━ */}
      <div style={{ gridColumn: '1 / -1' }}>
        <CausationView
          data={causation}
          trendsData={trends}
          reviewsData={reviews}
          eventsData={events}
          newsData={industry?.news}
        />
      </div>
    </>
  )
})
