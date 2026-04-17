import { useCallback, useEffect, useMemo, useState, memo } from 'react'
import EventQuickInput from './EventQuickInput.jsx'
import {
  loadCausalNotes, saveCausalNotes, deleteCausalNote, subscribeCausalNotes,
} from '../services/patternStore.js'
import { useDomain } from '../context/DomainContext.jsx'
import {
  QUICK_EVENT_PRESETS, MEDIA_OPTIONS, REGION_OPTIONS,
  IMPACT_LABELS, IMPACT_COLORS, LANE_LABELS, LANE_COLORS,
} from '../constants.js'

const MEDIA_LABEL_MAP = Object.fromEntries(MEDIA_OPTIONS.map(m => [m.key, m.label]))
const REGION_LABEL_MAP = Object.fromEntries(REGION_OPTIONS.map(r => [r.key, r.label]))

const MAX_RECENT = 5

function resolvePreset(eventType, domainId) {
  if (!eventType || eventType === 'free') return null
  const domainPresets = QUICK_EVENT_PRESETS[domainId] || []
  const inDomain = domainPresets.find(p => p.key === eventType)
  if (inDomain) return inDomain
  for (const list of Object.values(QUICK_EVENT_PRESETS)) {
    const f = list.find(p => p.key === eventType)
    if (f) return f
  }
  return null
}

/**
 * 施策記録パネル (ActionsView トップ配置用)
 *
 * CausationView を開かなくても施策が記録できるよう、EventQuickInput を薄くラップし、
 * IndexedDB (patternStore) に直接保存する。保存後は subscribeCausalNotes 経由で
 * RecommendedActions / HistoryView のオーバレイが自動更新される。
 *
 * 直近の記録を一覧表示し、誤記録を即削除できるようにしている
 * (編集は CausationView 側で実施)。
 */
export default memo(function QuickRecordPanel() {
  const { domainId } = useDomain()

  const [notes, setNotes] = useState(() => loadCausalNotes() || [])
  const [expanded, setExpanded] = useState(false)

  useEffect(() => subscribeCausalNotes(next => setNotes(next || [])), [])

  const handleAdd = useCallback((note) => {
    const current = loadCausalNotes() || []
    saveCausalNotes([note, ...current])
  }, [])

  // 手動/クイック入力で追加した記録のみを新しい順に。自動検出由来は除外 (CausationView 側で管理)。
  const recent = useMemo(() => {
    const mine = (notes || []).filter(n => !n.auto)
    const sorted = [...mine].sort((a, b) => {
      const da = a.date || ''
      const db = b.date || ''
      if (da !== db) return db.localeCompare(da)
      // 同日なら id から timestamp を推測して降順
      const ta = Number((a.id || '').match(/(\d{10,})/)?.[1] || 0)
      const tb = Number((b.id || '').match(/(\d{10,})/)?.[1] || 0)
      return tb - ta
    })
    return sorted
  }, [notes])

  const shown = expanded ? recent : recent.slice(0, MAX_RECENT)

  const handleDelete = useCallback((id) => {
    deleteCausalNote(id)
  }, [])

  return (
    <div className="panel" style={{ gridColumn: '1 / -1' }}>
      <div className="panel-header">
        <div className="panel-header-left">
          <div className="panel-indicator" style={{ background: '#f0883e' }} />
          <span className="panel-title" style={{ color: '#f0883e' }}>施策記録</span>
          <span className="panel-tag">何をしたか残す</span>
          {recent.length > 0 && (
            <span className="panel-tag" style={{ color: '#8b949e' }}>
              記録 {recent.length}件
            </span>
          )}
        </div>
      </div>
      <div className="panel-body">
        <EventQuickInput onAddNote={handleAdd} />

        {recent.length > 0 && (
          <div style={{
            marginTop: 10,
            borderTop: '1px solid #21262d',
            paddingTop: 8,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 6,
            }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: '#8b949e' }}>
                最近の記録
              </span>
              {recent.length > MAX_RECENT && (
                <button
                  onClick={() => setExpanded(v => !v)}
                  style={{
                    fontSize: 9, padding: '2px 8px', borderRadius: 4, cursor: 'pointer',
                    border: '1px solid #30363d',
                    background: 'transparent', color: '#8b949e',
                  }}
                >
                  {expanded ? '折りたたむ' : `すべて表示 (${recent.length})`}
                </button>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {shown.map(note => (
                <RecentRow
                  key={note.id}
                  note={note}
                  preset={resolvePreset(note.eventType, domainId)}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="panel-footer" style={{ fontSize: 9, color: '#484f58' }}>
        記録した施策は推奨アクションの学習と、推移タブのチャート上マーカーに反映されます。
      </div>
    </div>
  )
})

const RecentRow = memo(function RecentRow({ note, preset, onDelete }) {
  const [confirming, setConfirming] = useState(false)
  const impactColor = IMPACT_COLORS[note.impact] || '#8b949e'
  const laneColor = note.lane ? LANE_COLORS[note.lane] : null
  const icon = preset?.icon || (note.eventType === 'free' ? '📝' : '▶')
  const label = preset?.label || note.event || '—'
  const memo = note.memo || (!preset && note.event) || ''

  const handleDeleteClick = useCallback(() => {
    if (!confirming) {
      setConfirming(true)
      setTimeout(() => setConfirming(false), 3000)
      return
    }
    onDelete(note.id)
  }, [confirming, note.id, onDelete])

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      background: '#0d1117',
      border: '1px solid #21262d',
      borderLeft: `3px solid ${impactColor}`,
      borderRadius: 6,
      padding: '6px 10px',
      fontSize: 11,
    }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <span style={{ fontSize: 10, color: '#6e7681', minWidth: 56 }}>
        {(note.date || '').slice(5) || '—'}
      </span>
      <span style={{ color: '#e6edf3', fontWeight: 600 }}>{label}</span>
      {laneColor && (
        <span style={{
          fontSize: 9, padding: '1px 5px', borderRadius: 3,
          border: `1px solid ${laneColor}55`,
          background: `${laneColor}14`,
          color: laneColor,
        }}>
          {LANE_LABELS[note.lane] || note.lane}
        </span>
      )}
      <span style={{
        fontSize: 9, padding: '1px 5px', borderRadius: 3,
        background: `${impactColor}22`,
        color: impactColor,
      }}>
        {IMPACT_LABELS[note.impact] || note.impact || '中立'}
      </span>
      {Array.isArray(note.media) && note.media.length > 0 && (
        <span style={{ fontSize: 9, color: '#f0883e' }}>
          📢 {note.media.map(k => MEDIA_LABEL_MAP[k] || k).join(', ')}
        </span>
      )}
      {note.region && (
        <span style={{ fontSize: 9, color: '#388bfd' }}>
          🌐 {REGION_LABEL_MAP[note.region] || note.region}
        </span>
      )}
      {memo && (
        <span style={{
          fontSize: 10, color: '#8b949e',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          maxWidth: 240,
        }} title={memo}>
          — {memo}
        </span>
      )}
      <button
        onClick={handleDeleteClick}
        title={confirming ? 'もう一度クリックで削除' : '削除'}
        style={{
          marginLeft: 'auto',
          fontSize: 10,
          padding: '2px 8px',
          borderRadius: 4,
          cursor: 'pointer',
          border: `1px solid ${confirming ? '#f85149' : '#30363d'}`,
          background: confirming ? 'rgba(248,81,73,0.15)' : 'transparent',
          color: confirming ? '#f85149' : '#6e7681',
          fontWeight: confirming ? 600 : 400,
        }}
      >
        {confirming ? '削除?' : '✕'}
      </button>
    </div>
  )
})
