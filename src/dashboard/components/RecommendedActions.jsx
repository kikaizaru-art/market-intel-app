import { useEffect, useMemo, useState, memo } from 'react'
import { useDomain } from '../context/DomainContext.jsx'
import {
  QUICK_EVENT_PRESETS, MEDIA_OPTIONS, REGION_OPTIONS,
  LANE_LABELS, LANE_COLORS,
} from '../constants.js'
import {
  recommendActions, countActionableSamples, extractNoteFacets,
} from '../../analyzers/actionRecommender.js'
import { loadCausalNotes, subscribeCausalNotes } from '../services/patternStore.js'

/**
 * 推奨アクションパネル
 *
 * 過去の施策 (eventType 付き) の前後でメトリクスを計測し、
 * 「過去に効いた施策」「逆効果だった施策」を現在の状況に紐付けて提示する。
 * 媒体・地域・レーン別のフィルタと、集計軸切替 (施策種別 / 媒体 / 地域) に対応。
 *
 * データソース: IndexedDB (loadCausalNotes) + causation.notes フォールバック。
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

const MEDIA_LABEL_MAP = Object.fromEntries(MEDIA_OPTIONS.map(m => [m.key, m.label]))
const REGION_LABEL_MAP = Object.fromEntries(REGION_OPTIONS.map(r => [r.key, r.label]))

const MATCH_COLORS = {
  risk:        { bg: 'rgba(86,211,100,0.15)',  fg: '#56d364' },
  opportunity: { bg: 'rgba(56,139,253,0.15)',  fg: '#388bfd' },
  stable:      { bg: 'rgba(210,168,255,0.15)', fg: '#d2a8ff' },
  warning:     { bg: 'rgba(248,81,73,0.15)',   fg: '#f85149' },
}

const GROUP_BY_OPTIONS = [
  { key: 'eventType', label: '施策種別' },
  { key: 'media',     label: '媒体' },
  { key: 'region',    label: '地域' },
]

export default memo(function RecommendedActions({ fallbackNotes, trendsData, reviewsData, risks, opportunities }) {
  const { domainId } = useDomain()

  const [notes, setNotes] = useState(() => {
    const persisted = loadCausalNotes()
    return persisted !== null ? persisted : (fallbackNotes || [])
  })

  useEffect(() => {
    return subscribeCausalNotes(next => setNotes(next || []))
  }, [])

  useEffect(() => {
    const persisted = loadCausalNotes()
    if (persisted === null && fallbackNotes?.length) setNotes(fallbackNotes)
  }, [fallbackNotes])

  // ─── フィルタ & 集計軸 ──────────────────────────────
  const [laneFilter, setLaneFilter] = useState(null)     // 'product' | 'marketing' | null
  const [mediaFilter, setMediaFilter] = useState(null)
  const [regionFilter, setRegionFilter] = useState(null)
  const [groupBy, setGroupBy] = useState('eventType')

  const filters = useMemo(
    () => ({ lane: laneFilter, media: mediaFilter, region: regionFilter }),
    [laneFilter, mediaFilter, regionFilter]
  )

  const facets = useMemo(() => extractNoteFacets(notes), [notes])
  const hasAnyTag = facets.lanes.length > 0 || facets.medias.length > 0 || facets.regions.length > 0

  const recommendations = useMemo(
    () => recommendActions({
      notes, trendsData, reviewsData, risks, opportunities,
      filters, groupBy,
    }),
    [notes, trendsData, reviewsData, risks, opportunities, filters, groupBy]
  )

  const { actionable, measured } = useMemo(
    () => countActionableSamples(notes, { trendsData, reviewsData, filters }),
    [notes, trendsData, reviewsData, filters]
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
              {actionable > 0 ? `${measured}/${actionable} 計測可能` : ''}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {GROUP_BY_OPTIONS.map(opt => {
            const active = groupBy === opt.key
            // 媒体/地域軸は該当タグの記録が1件以上ないと無効
            const disabled =
              (opt.key === 'media' && facets.medias.length === 0) ||
              (opt.key === 'region' && facets.regions.length === 0)
            return (
              <button
                key={opt.key}
                onClick={() => !disabled && setGroupBy(opt.key)}
                disabled={disabled}
                className="macro-toggle-btn"
                style={{
                  borderColor: active ? 'rgba(86,211,100,0.5)' : '#30363d',
                  background: active ? 'rgba(86,211,100,0.15)' : 'transparent',
                  color: active ? '#56d364' : disabled ? '#484f58' : '#8b949e',
                  fontSize: 10,
                  padding: '2px 8px',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.4 : 1,
                }}
                title={disabled ? 'タグ付き施策記録がないと切替できません' : `集計軸: ${opt.label}`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* フィルタチップ */}
      {hasAnyTag && (
        <div style={{ padding: '4px 12px 0', display: 'flex', flexDirection: 'column', gap: 3 }}>
          {facets.lanes.length > 1 && (
            <FilterRow
              label="レーン"
              options={facets.lanes.map(k => ({ key: k, label: LANE_LABELS[k] || k, color: LANE_COLORS[k] }))}
              value={laneFilter}
              onChange={setLaneFilter}
            />
          )}
          {facets.medias.length > 0 && (
            <FilterRow
              label="媒体"
              options={facets.medias.map(k => ({ key: k, label: MEDIA_LABEL_MAP[k] || k, color: '#f0883e' }))}
              value={mediaFilter}
              onChange={setMediaFilter}
            />
          )}
          {facets.regions.length > 0 && (
            <FilterRow
              label="地域"
              options={facets.regions.map(k => ({ key: k, label: REGION_LABEL_MAP[k] || k, color: '#388bfd' }))}
              value={regionFilter}
              onChange={setRegionFilter}
            />
          )}
        </div>
      )}

      <div className="panel-body">
        {recommendations.length === 0 ? (
          <EmptyState actionable={actionable} measured={measured} hasFilters={!!(laneFilter || mediaFilter || regionFilter)} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recommendations.slice(0, 6).map(rec => (
              <RecommendationCard
                key={`${rec.groupBy}:${rec.groupKey}`}
                rec={rec}
                preset={resolvePreset(rec.eventType, domainId)}
                groupBy={groupBy}
              />
            ))}
          </div>
        )}
      </div>
      <div className="panel-footer" style={{ fontSize: 9, color: '#484f58' }}>
        施策記録後のレビュー/トレンド変動 (前後2ヶ月 or 4週平均) から算出。同時期の市場平均を差し引いた純効果で評価。2件以上の記録で表示。
      </div>
    </div>
  )
})

const FilterRow = memo(function FilterRow({ label, options, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
      <span style={{ fontSize: 9, color: '#6e7681', minWidth: 28 }}>{label}</span>
      {options.map(opt => {
        const active = value === opt.key
        const color = opt.color || '#8b949e'
        return (
          <button
            key={opt.key}
            onClick={() => onChange(active ? null : opt.key)}
            className="macro-toggle-btn"
            style={{
              borderColor: active ? color : '#30363d',
              background: active ? `${color}22` : 'transparent',
              color: active ? color : '#8b949e',
              fontSize: 10,
              padding: '1px 8px',
            }}
          >{opt.label}</button>
        )
      })}
      {value && (
        <button
          onClick={() => onChange(null)}
          className="macro-toggle-btn"
          style={{ borderColor: '#30363d', background: 'transparent', color: '#6e7681', fontSize: 10, padding: '1px 6px' }}
        >✕</button>
      )}
    </div>
  )
})

const EmptyState = memo(function EmptyState({ actionable, measured, hasFilters }) {
  let msg
  if (hasFilters && actionable === 0) {
    msg = 'フィルタに該当する施策記録がありません。'
  } else if (actionable === 0) {
    msg = '施策記録がありません。「次の一手」→因果関係パネル上部の「施策を記録」から追加してください。'
  } else if (actionable < 2) {
    msg = `施策記録が ${actionable}件です。2件以上で推奨が表示されます。`
  } else if (measured < 2) {
    msg = `施策記録は ${actionable}件ありますが、計測窓 (前後のデータ) に十分な履歴がまだ揃っていません。`
  } else {
    msg = '同一集計軸の記録が 2件以上揃うと推奨が表示されます。'
  }
  return (
    <div style={{ fontSize: 10, color: '#6e7681', padding: 12, textAlign: 'center', lineHeight: 1.6 }}>
      {msg}
    </div>
  )
})

function signed(v) {
  if (v == null || Number.isNaN(v)) return '—'
  return `${v > 0 ? '+' : ''}${v}%`
}

function labelForGroup(groupBy, key, preset) {
  if (groupBy === 'media')  return MEDIA_LABEL_MAP[key] || key
  if (groupBy === 'region') return REGION_LABEL_MAP[key] || key
  if (groupBy === 'lane')   return LANE_LABELS[key] || key
  return preset?.label || key
}

function iconForGroup(groupBy, preset) {
  if (groupBy === 'media')  return '📢'
  if (groupBy === 'region') return '🌐'
  if (groupBy === 'lane')   return '⚙'
  return preset?.icon || '▶'
}

const RecommendationCard = memo(function RecommendationCard({ rec, preset, groupBy }) {
  const [expanded, setExpanded] = useState(false)
  const accent = rec.isRisky ? '#f85149' : rec.isProven ? '#56d364' : '#8b949e'
  const bg = rec.isRisky
    ? 'rgba(248,81,73,0.05)'
    : rec.isProven
      ? 'rgba(86,211,100,0.05)'
      : '#161b22'
  const deltaColor = rec.avgNetDelta > 0 ? '#56d364' : rec.avgNetDelta < 0 ? '#f85149' : '#e3b341'
  const rateColor =
    rec.positiveRate >= 60 ? '#56d364' :
    rec.positiveRate >= 40 ? '#e3b341' : '#f85149'
  const matchColor = rec.match ? MATCH_COLORS[rec.match.kind] : null

  const title = labelForGroup(groupBy, rec.groupKey, preset)
  const icon  = iconForGroup(groupBy, preset)
  const fullSamples = rec.allSamples || rec.recentSamples || []
  const hasMore = fullSamples.length > rec.recentSamples.length

  return (
    <div style={{
      background: bg,
      border: `1px solid ${accent}55`,
      borderLeft: `3px solid ${accent}`,
      borderRadius: 8,
      padding: '8px 12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#e6edf3' }}>{title}</span>
        {rec.match && matchColor && (
          <span style={{
            fontSize: 9, padding: '1px 6px', borderRadius: 3, fontWeight: 600,
            background: matchColor.bg, color: matchColor.fg,
          }}>
            {rec.match.label}
          </span>
        )}
        {rec.marketAdjusted && (
          <span
            title="同時期の市場 (競合アプリ or 他ジャンル) 平均変化を差し引いた純効果"
            style={{
              fontSize: 9, padding: '1px 6px', borderRadius: 3, fontWeight: 600,
              background: 'rgba(56,139,253,0.12)', color: '#58a6ff', border: '1px solid rgba(56,139,253,0.35)',
            }}
          >
            市場補正済
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, fontSize: 10, color: '#8b949e', flexWrap: 'wrap' }}>
          <span>過去 <strong style={{ color: '#e6edf3' }}>{rec.trials}</strong>回</span>
          <span>好影響率 <strong style={{ color: rateColor }}>{rec.positiveRate}%</strong></span>
          <span>純効果 <strong style={{ color: deltaColor }}>{signed(rec.avgNetDelta)}</strong></span>
          <span>信頼度 <strong style={{ color: '#d2a8ff' }}>{Math.round(rec.confidence * 100)}%</strong></span>
        </div>
      </div>
      {rec.marketAdjusted && (
        <div style={{ fontSize: 9, color: '#6e7681', marginBottom: 6, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <span>生の変動 <strong style={{ color: '#8b949e' }}>{signed(rec.avgRawDelta)}</strong></span>
          <span>市場分 <strong style={{ color: '#8b949e' }}>{signed(rec.avgBaselineDelta)}</strong></span>
          <span style={{ color: '#484f58' }}>(純 = 生 − 市場)</span>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, fontSize: 9, color: '#6e7681', flexWrap: 'wrap', alignItems: 'center' }}>
        {rec.recentSamples.map((s, i) => {
          const hasBaseline = s.baselineDelta != null
          const tooltip = hasBaseline
            ? `生 ${signed(s.rawDelta)} − 市場 ${signed(s.baselineDelta)} = 純 ${signed(s.netDelta)}`
            : `効果 ${signed(s.netDelta)}`
          return (
            <span
              key={i}
              title={tooltip}
              style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 4, padding: '2px 6px' }}
            >
              {s.date.slice(5)}
              <span style={{ marginLeft: 4, color: s.verdict === 'positive' ? '#56d364' : s.verdict === 'negative' ? '#f85149' : '#e3b341' }}>
                {signed(s.netDelta)}
              </span>
            </span>
          )
        })}
        <button
          onClick={() => setExpanded(v => !v)}
          className="macro-toggle-btn"
          style={{
            borderColor: expanded ? `${accent}66` : '#30363d',
            background: expanded ? `${accent}15` : 'transparent',
            color: expanded ? accent : '#8b949e',
            fontSize: 9,
            padding: '1px 6px',
          }}
          title="この推奨の根拠となった過去の施策記録を一覧表示"
        >
          {expanded ? '▲ 根拠を閉じる' : `▼ 根拠を見る (${fullSamples.length}件${hasMore ? '' : ''})`}
        </button>
        <span style={{ marginLeft: 'auto', color: '#484f58' }}>
          好 {rec.positive} / 悪 {rec.negative} / 中 {rec.neutral}
        </span>
      </div>
      {expanded && <EvidenceTable samples={fullSamples} marketAdjusted={rec.marketAdjusted} />}
    </div>
  )
})

const EvidenceTable = memo(function EvidenceTable({ samples, marketAdjusted }) {
  if (!samples?.length) return null
  return (
    <div style={{ marginTop: 8, borderTop: '1px dashed #30363d', paddingTop: 8 }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
          <thead>
            <tr style={{ color: '#6e7681', textAlign: 'left' }}>
              <th style={{ padding: '3px 6px', fontWeight: 600 }}>日付</th>
              <th style={{ padding: '3px 6px', fontWeight: 600 }}>施策</th>
              <th style={{ padding: '3px 6px', fontWeight: 600 }}>対象</th>
              <th style={{ padding: '3px 6px', fontWeight: 600 }}>タグ</th>
              {marketAdjusted && (
                <>
                  <th style={{ padding: '3px 6px', fontWeight: 600, textAlign: 'right' }}>生</th>
                  <th style={{ padding: '3px 6px', fontWeight: 600, textAlign: 'right' }}>市場</th>
                </>
              )}
              <th style={{ padding: '3px 6px', fontWeight: 600, textAlign: 'right' }}>{marketAdjusted ? '純効果' : '効果'}</th>
              <th style={{ padding: '3px 6px', fontWeight: 600, textAlign: 'right' }}>窓</th>
            </tr>
          </thead>
          <tbody>
            {samples.map((s, i) => {
              const deltaColor = s.verdict === 'positive' ? '#56d364' : s.verdict === 'negative' ? '#f85149' : '#e3b341'
              const tagPills = []
              if (s.lane) tagPills.push({ label: LANE_LABELS[s.lane] || s.lane, color: LANE_COLORS[s.lane] || '#8b949e' })
              if (s.region) tagPills.push({ label: REGION_LABEL_MAP[s.region] || s.region, color: '#388bfd' })
              for (const m of s.media || []) tagPills.push({ label: MEDIA_LABEL_MAP[m] || m, color: '#f0883e' })
              const metricLabel = s.metric === 'review_score' ? 'レビュー'
                : s.metric === 'trend_genre' ? 'ジャンルT'
                : s.metric === 'trend_total' ? 'トレンド' : s.metric
              return (
                <tr key={s.id || i} style={{ borderTop: '1px solid #21262d' }}>
                  <td style={{ padding: '4px 6px', color: '#8b949e', whiteSpace: 'nowrap' }}>{s.date}</td>
                  <td style={{ padding: '4px 6px', color: '#e6edf3', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' }} title={s.memo ? `${s.event}\n${s.memo}` : s.event}>
                    {s.event || '—'}
                    {s.memo && <span style={{ color: '#6e7681', marginLeft: 4 }}>— {s.memo}</span>}
                  </td>
                  <td style={{ padding: '4px 6px', color: '#8b949e', whiteSpace: 'nowrap' }}>{s.app || '—'}</td>
                  <td style={{ padding: '4px 6px' }}>
                    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 2 }}>
                      {tagPills.map((t, idx) => (
                        <span
                          key={idx}
                          style={{
                            fontSize: 8, padding: '0 4px', borderRadius: 2,
                            background: `${t.color}22`, color: t.color, border: `1px solid ${t.color}55`,
                          }}
                        >{t.label}</span>
                      ))}
                      {tagPills.length === 0 && <span style={{ color: '#484f58' }}>—</span>}
                    </span>
                  </td>
                  {marketAdjusted && (
                    <>
                      <td style={{ padding: '4px 6px', color: '#8b949e', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{signed(s.rawDelta)}</td>
                      <td style={{ padding: '4px 6px', color: '#8b949e', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{signed(s.baselineDelta)}</td>
                    </>
                  )}
                  <td style={{ padding: '4px 6px', color: deltaColor, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{signed(s.netDelta)}</td>
                  <td style={{ padding: '4px 6px', color: '#484f58', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} title={`前${s.windowBefore} / 後${s.windowAfter}`}>
                    {s.windowBefore}/{s.windowAfter}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 9, color: '#484f58', marginTop: 6, lineHeight: 1.5 }}>
        メトリクス: レビュー=前後2ヶ月平均スコア / ジャンルT=対象ジャンル週次トレンド / トレンド=全ジャンル合算。「窓」は計測に使った前後のデータ点数。
      </div>
    </div>
  )
})
