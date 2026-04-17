import { useMemo, useState, useEffect, useCallback, memo } from 'react'
import CausationView from './CausationView.jsx'
import LlmSettings from './LlmSettings.jsx'
import RecommendedActions from './RecommendedActions.jsx'
import QuickRecordPanel from './QuickRecordPanel.jsx'
import { detectAllAnomalies } from '../../analyzers/anomaly.js'
import { calcGenreTrends } from '../../analyzers/trend.js'
import { generateCausationSummary, analyzeSeasonalPatterns } from '../../analyzers/llmAnalyzer.js'
import { checkConnection, isAvailable, onStatusChange } from '../services/llmService.js'
import { getLearningStats } from '../services/patternStore.js'
import { PALETTE, TREND_ICONS, TREND_COLORS } from '../constants.js'

/**
 * 次の一手タブ — 蓄積された因果パターンから行動を導く
 *
 * - LLM サマリーパネル（Ollama 接続時は AI 生成、未接続時はテンプレート）
 * - リスク/チャンス サマリーカード
 * - 季節要因分析
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

  // ─── LLM サマリー ──────────────────────────────────
  const [summary, setSummary] = useState(null)
  const [seasonalAnalysis, setSeasonalAnalysis] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [showLlmSettings, setShowLlmSettings] = useState(false)
  const [llmAvailable, setLlmAvailable] = useState(isAvailable)
  const [showCausationDetail, setShowCausationDetail] = useState(false)

  // LLM接続状態を監視
  useEffect(() => {
    return onStatusChange(({ status }) => {
      setLlmAvailable(status === 'connected')
    })
  }, [])

  // 初回マウント時に接続チェック
  useEffect(() => {
    checkConnection()
  }, [])

  const allRisks = useMemo(() => [
    ...risks,
    ...reviewRisks.map(r => ({ type: 'review', ...r })),
  ], [risks, reviewRisks])

  // サマリー生成
  const generateSummary = useCallback(async () => {
    setSummaryLoading(true)
    try {
      const memos = causation?.notes || []
      const learningStats = getLearningStats()

      const [summaryResult, seasonalResult] = await Promise.all([
        generateCausationSummary({ memos, risks: allRisks, opportunities, learningStats }),
        analyzeSeasonalPatterns({
          weeklyData: weeklyData,
          metrics: GENRES,
          seasonalPatterns: [],
          historicalMemos: memos,
        }),
      ])

      setSummary(summaryResult)
      setSeasonalAnalysis(seasonalResult)
    } catch (e) {
      console.warn('[actions] summary generation failed:', e)
    } finally {
      setSummaryLoading(false)
    }
  }, [causation?.notes, allRisks, opportunities, weeklyData, GENRES])

  // データが揃ったらサマリー生成
  useEffect(() => {
    generateSummary()
  }, [generateSummary])

  return (
    <>
      {/* ━━━ 施策記録 (primary: 毎日使う入力) ━━━ */}
      <QuickRecordPanel />

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

      {/* ━━━ 推奨アクション ━━━ */}
      <RecommendedActions
        fallbackNotes={causation?.notes}
        trendsData={trends}
        reviewsData={reviews}
        risks={allRisks}
        opportunities={opportunities}
      />

      {/* ━━━ AI サマリー ━━━ */}
      <div className="panel" style={{ gridColumn: '1 / -1' }}>
        <div className="panel-header">
          <div className="panel-header-left">
            <div className="panel-indicator" style={{ background: '#d2a8ff' }} />
            <span className="panel-title" style={{ color: '#d2a8ff' }}>AI 分析</span>
            <span className="panel-tag">
              {summary?.source === 'llm' ? 'Ollama' : 'テンプレート'}
            </span>
            {summaryLoading && (
              <span style={{ fontSize: 9, color: '#e3b341' }}>生成中…</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <LlmSettings compact />
            <button
              onClick={() => setShowLlmSettings(v => !v)}
              style={{
                fontSize: 10, padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
                border: '1px solid rgba(210,168,255,0.3)',
                background: showLlmSettings ? 'rgba(210,168,255,0.2)' : 'rgba(210,168,255,0.08)',
                color: '#d2a8ff',
              }}
            >
              {showLlmSettings ? '\u2715' : '\u2699'}
            </button>
            <button
              onClick={generateSummary}
              disabled={summaryLoading}
              style={{
                fontSize: 10, padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
                border: '1px solid rgba(210,168,255,0.3)',
                background: 'rgba(210,168,255,0.08)', color: '#d2a8ff',
                opacity: summaryLoading ? 0.5 : 1,
              }}
            >
              {'\u21BB'} 再生成
            </button>
          </div>
        </div>
        <div className="panel-body">
          {showLlmSettings && <LlmSettings />}

          {/* 因果サマリー */}
          {summary && (
            <div style={{
              background: '#161b22', borderRadius: 8, border: '1px solid #21262d',
              padding: '10px 12px', marginBottom: seasonalAnalysis ? 8 : 0,
            }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#d2a8ff', marginBottom: 6 }}>
                状況サマリー
              </div>
              <div style={{
                fontSize: 11, color: '#c9d1d9', lineHeight: 1.6, whiteSpace: 'pre-wrap',
              }}>
                {summary.summary}
              </div>
            </div>
          )}

          {/* 季節分析 */}
          {seasonalAnalysis && (
            <div style={{
              background: '#161b22', borderRadius: 8, border: '1px solid #21262d',
              padding: '10px 12px',
            }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#388bfd', marginBottom: 6 }}>
                季節要因
              </div>
              <div style={{
                fontSize: 11, color: '#c9d1d9', lineHeight: 1.6, whiteSpace: 'pre-wrap',
              }}>
                {seasonalAnalysis.analysis}
              </div>
            </div>
          )}

          {!summary && !summaryLoading && (
            <div style={{ fontSize: 10, color: '#6e7681', textAlign: 'center', padding: 12 }}>
              データ読み込み中…
            </div>
          )}
        </div>
      </div>

      {/* ━━━ 詳細: 因果ログ (分析者向け — 既定で折りたたみ) ━━━ */}
      <div style={{ gridColumn: '1 / -1' }}>
        {!showCausationDetail ? (
          <div className="panel">
            <div className="panel-header">
              <div className="panel-header-left">
                <div className="panel-indicator" style={{ background: '#6e7681' }} />
                <span className="panel-title" style={{ color: '#8b949e' }}>詳細: 因果ログ</span>
                <span className="panel-tag">自動検出・手動メモ・学習統計</span>
              </div>
              <button
                onClick={() => setShowCausationDetail(true)}
                style={{
                  fontSize: 10, padding: '3px 10px', borderRadius: 4, cursor: 'pointer',
                  border: '1px solid #30363d',
                  background: 'transparent', color: '#8b949e',
                }}
              >
                開く
              </button>
            </div>
            <div className="panel-footer" style={{ fontSize: 9, color: '#484f58' }}>
              施策の積み上がりや自動検出パターンを詳細に確認したい時だけ展開してください。
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
              <button
                onClick={() => setShowCausationDetail(false)}
                style={{
                  fontSize: 10, padding: '3px 10px', borderRadius: 4, cursor: 'pointer',
                  border: '1px solid #30363d',
                  background: 'transparent', color: '#8b949e',
                }}
              >
                詳細を閉じる
              </button>
            </div>
            <CausationView
              data={causation}
              trendsData={trends}
              reviewsData={reviews}
              eventsData={events}
              newsData={industry?.news}
            />
          </>
        )}
      </div>
    </>
  )
})
