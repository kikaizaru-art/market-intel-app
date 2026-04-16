import { useEffect, useMemo, useState, memo } from 'react'
import { useDomain } from '../context/DomainContext.jsx'
import { QUICK_EVENT_PRESETS } from '../constants.js'
import { recommendActions, countActionableSamples } from '../../analyzers/actionRecommender.js'
import { loadCausalNotes, subscribeCausalNotes } from '../services/patternStore.js'

/**
 * 推奨アクションパネル
 *
 * 過去の施策 (eventType 付き) の前後でメトリクスを計測し、
 * 「過去に効いた施策」「逆効果だった施策」を現在の状況に紐付けて提示する。
 *
 * データソース: IndexedDB (loadCausalNotes) + causation.notes フォールバック。
 * EventQuickInput で記録が追加されると subscribeCausalNotes 経由で再計算する。
 */
function resolvePreset(eventType, domainId) {
  const domainPresets = QUICK_EVENT_PRESETS[domainId] || []
  const inDomain = domainPresets.find(p => p.key === eventType)
  if (inDomain) return inDomain
  for (const list of Object.values(QUICK_EVENT_PRESETS)) {
    const f = list.find(p => p.key === eventType)
    if (f) return f
  }
  return { key: eventType, label: eventType, icon: '▶' }
}

const MATCH_COLORS = {
  risk:        { bg: 'rgba(86,211,100,0.15)',  fg: '#56d364' },
  opportunity: { bg: 'rgba(56,139,253,0.15)',  fg: '#388bfd' },
  stable:      { bg: 'rgba(210,168,255,0.15)', fg: '#d2a8ff' },
  warning:     { bg: 'rgba(248,81,73,0.15)',   fg: '#f85149' },
}

export default memo(function RecommendedActions({ fallbackNotes, trendsData, reviewsData, risks, opportunities }) {
  const { domainId } = useDomain()

  // IndexedDB が最新 — 購読して差分を拾う
  const [notes, setNotes] = useState(() => {
    const persisted = loadCausalNotes()
    return persisted !== null ? persisted : (fallbackNotes || [])
  })

  useEffect(() => {
    return subscribeCausalNotes(next => setNotes(next || []))
  }, [])

  // 初期ロード時、IndexedDB が空なら fallback を反映
  useEffect(() => {
    const persisted = loadCausalNotes()
    if (persisted === null && fallbackNotes?.length) setNotes(fallbackNotes)
  }, [fallbackNotes])

  const recommendations = useMemo(
    () => recommendActions({ notes, trendsData, reviewsData, risks, opportunities }),
    [notes, trendsData, reviewsData, risks, opportunities]
  )

  const { actionable, measured } = useMemo(
    () => countActionableSamples(notes, { trendsData, reviewsData }),
    [notes, trendsData, reviewsData]
  )

  return (
    <div className="panel" style={{ gridColumn: '1 / -1' }}>
      <div className="panel-header">
        <div className="panel-header-left">
          <div className="panel-indicator" style={{ background: '#56d364' }} />
          <span className="panel-title" style={{ color: '#56d364' }}>推奨アクション</span>
          <span className="panel-tag">過去の施策 × 効果</span>
          {recommendations.length > 0 && (
            <span className="panel-tag">{recommendations.length}件</span>
          )}
          {actionable > 0 && (
            <span className="panel-tag" style={{ color: '#6e7681' }}>
              施策記録 {measured}/{actionable} 計測可能
            </span>
          )}
        </div>
      </div>
      <div className="panel-body">
        {recommendations.length === 0 ? (
          <EmptyState actionable={actionable} measured={measured} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recommendations.slice(0, 6).map(rec => (
              <RecommendationCard
                key={rec.eventType}
                rec={rec}
                preset={resolvePreset(rec.eventType, domainId)}
              />
            ))}
          </div>
        )}
      </div>
      <div className="panel-footer" style={{ fontSize: 9, color: '#484f58' }}>
        施策記録後のレビュー/トレンド変動 (前後2ヶ月 or 4週平均) から算出。2件以上の記録で表示。
      </div>
    </div>
  )
})

const EmptyState = memo(function EmptyState({ actionable, measured }) {
  let msg
  if (actionable === 0) {
    msg = '施策記録がありません。「次の一手」→因果関係パネル上部の「施策を記録」から追加してください。'
  } else if (actionable < 2) {
    msg = `施策記録が ${actionable}件です。2件以上で推奨が表示されます。`
  } else if (measured < 2) {
    msg = `施策記録は ${actionable}件ありますが、計測窓 (前後のデータ) に十分な履歴がまだ揃っていません。`
  } else {
    msg = '同一施策タイプの記録が 2件以上揃うと推奨が表示されます。'
  }
  return (
    <div style={{ fontSize: 10, color: '#6e7681', padding: 12, textAlign: 'center', lineHeight: 1.6 }}>
      {msg}
    </div>
  )
})

const RecommendationCard = memo(function RecommendationCard({ rec, preset }) {
  const accent = rec.isRisky ? '#f85149' : rec.isProven ? '#56d364' : '#8b949e'
  const bg = rec.isRisky
    ? 'rgba(248,81,73,0.05)'
    : rec.isProven
      ? 'rgba(86,211,100,0.05)'
      : '#161b22'
  const deltaColor = rec.avgDelta > 0 ? '#56d364' : rec.avgDelta < 0 ? '#f85149' : '#e3b341'
  const rateColor =
    rec.positiveRate >= 60 ? '#56d364' :
    rec.positiveRate >= 40 ? '#e3b341' : '#f85149'
  const matchColor = rec.match ? MATCH_COLORS[rec.match.kind] : null

  return (
    <div style={{
      background: bg,
      border: `1px solid ${accent}55`,
      borderLeft: `3px solid ${accent}`,
      borderRadius: 8,
      padding: '8px 12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 16 }}>{preset.icon}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#e6edf3' }}>{preset.label}</span>
        {rec.match && matchColor && (
          <span style={{
            fontSize: 9, padding: '1px 6px', borderRadius: 3, fontWeight: 600,
            background: matchColor.bg, color: matchColor.fg,
          }}>
            {rec.match.label}
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, fontSize: 10, color: '#8b949e', flexWrap: 'wrap' }}>
          <span>過去 <strong style={{ color: '#e6edf3' }}>{rec.trials}</strong>回</span>
          <span>好影響率 <strong style={{ color: rateColor }}>{rec.positiveRate}%</strong></span>
          <span>平均効果 <strong style={{ color: deltaColor }}>{rec.avgDelta > 0 ? '+' : ''}{rec.avgDelta}%</strong></span>
          <span>信頼度 <strong style={{ color: '#d2a8ff' }}>{Math.round(rec.confidence * 100)}%</strong></span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, fontSize: 9, color: '#6e7681', flexWrap: 'wrap' }}>
        {rec.recentSamples.map((s, i) => (
          <span key={i} style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 4, padding: '2px 6px' }}>
            {s.date.slice(5)}
            <span style={{ marginLeft: 4, color: s.verdict === 'positive' ? '#56d364' : s.verdict === 'negative' ? '#f85149' : '#e3b341' }}>
              {s.deltaPct > 0 ? '+' : ''}{s.deltaPct}%
            </span>
          </span>
        ))}
        <span style={{ marginLeft: 'auto', color: '#484f58' }}>
          好 {rec.positive} / 悪 {rec.negative} / 中 {rec.neutral}
        </span>
      </div>
    </div>
  )
})
