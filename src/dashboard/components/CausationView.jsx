import { useState, useMemo, useEffect, useCallback, memo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { ChartTooltip, ImpactDot } from './shared/index.js'
import {
  IMPACT_LABELS, IMPACT_COLORS, LAYER_COLORS,
  PATTERN_TYPE_LABELS, PATTERN_TYPE_COLORS,
  AUTO_STATUS_COLORS,
} from '../constants.js'
import { generateAutoMemos } from '../../analyzers/autoMemo.js'
import {
  getPatternWeights, getLearningStats, recordFeedback, resetLearning,
} from '../services/patternStore.js'

const LAYER_OPTIONS = ['マクロ', '競合', 'ユーザー']
const IMPACT_OPTIONS = ['positive', 'negative', 'neutral']
const VIEW_MODES = ['全て', '手動', '自動']

export default memo(function CausationView({
  data: initialData,
  trendsData,
  reviewsData,
  eventsData,
  newsData,
}) {
  const [notes, setNotes] = useState(initialData.notes)
  const [form, setForm] = useState({ date: '', event: '', app: '', layer: 'マクロ', impact: 'neutral', memo: '' })
  const [showForm, setShowForm] = useState(false)
  const [layerFilter, setLayerFilter] = useState('全て')
  const [impactFilter, setImpactFilter] = useState('全て')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState('全て')
  const [showLearning, setShowLearning] = useState(false)
  const [learningVersion, setLearningVersion] = useState(0)

  // ─── 自動メモ生成 ──────────────────────────────────
  const [autoMemos, setAutoMemos] = useState([])

  const regenerateAutoMemos = useCallback(() => {
    const weights = getPatternWeights()
    const memos = generateAutoMemos({
      trendsData,
      reviewsData,
      eventsData,
      newsData,
      existingNotes: notes.filter(n => !n.auto),
      patternWeights: weights,
      currentDate: new Date().toISOString().slice(0, 10),
    })
    setAutoMemos(memos)
  }, [trendsData, reviewsData, eventsData, newsData, notes])

  useEffect(() => {
    regenerateAutoMemos()
  }, [regenerateAutoMemos])

  // ─── ハンドラー ────────────────────────────────────
  function handleAdd(e) {
    e.preventDefault()
    if (!form.date || !form.event) return
    setNotes(prev => [{ id: `note_${Date.now()}`, ...form }, ...prev])
    setForm({ date: '', event: '', app: '', layer: 'マクロ', impact: 'neutral', memo: '' })
    setShowForm(false)
  }

  function handleDelete(id) {
    setNotes(prev => prev.filter(n => n.id !== id))
    setAutoMemos(prev => prev.filter(m => m.id !== id))
  }

  function handleConfirm(autoMemo) {
    recordFeedback('confirmed', autoMemo)
    // 承認 → 手動メモに変換して保存
    const confirmed = {
      id: autoMemo.id,
      date: autoMemo.date,
      event: autoMemo.event,
      app: autoMemo.app,
      layer: autoMemo.layer,
      impact: autoMemo.impact,
      memo: autoMemo.memo,
      autoConfirmed: true,
      patternType: autoMemo.patternType,
      confidence: autoMemo.confidence,
    }
    setNotes(prev => [confirmed, ...prev])
    setAutoMemos(prev => prev.filter(m => m.id !== autoMemo.id))
    setLearningVersion(v => v + 1)
  }

  function handleReject(autoMemo) {
    recordFeedback('rejected', autoMemo)
    setAutoMemos(prev => prev.filter(m => m.id !== autoMemo.id))
    setLearningVersion(v => v + 1)
  }

  function handleResetLearning() {
    resetLearning()
    setLearningVersion(v => v + 1)
    regenerateAutoMemos()
  }

  // ─── 統合リスト (手動 + 自動) ──────────────────────
  const allItems = useMemo(() => {
    const manualNotes = notes.map(n => ({ ...n, _source: n.autoConfirmed ? 'auto_confirmed' : 'manual' }))
    const pendingAuto = autoMemos.map(m => ({ ...m, _source: 'auto' }))

    let combined
    if (viewMode === '手動') combined = manualNotes.filter(n => !n.autoConfirmed)
    else if (viewMode === '自動') combined = [...pendingAuto, ...manualNotes.filter(n => n.autoConfirmed)]
    else combined = [...pendingAuto, ...manualNotes]

    return combined
      .filter(n => layerFilter === '全て' || n.layer === layerFilter)
      .filter(n => impactFilter === '全て' || n.impact === impactFilter)
      .filter(n => {
        if (!searchQuery) return true
        const q = searchQuery.toLowerCase()
        return n.event.toLowerCase().includes(q) || (n.app && n.app.toLowerCase().includes(q)) || (n.memo && n.memo.toLowerCase().includes(q))
      })
      .sort((a, b) => {
        // 未確認の自動メモを上位に
        if (a._source === 'auto' && b._source !== 'auto') return -1
        if (a._source !== 'auto' && b._source === 'auto') return 1
        return b.date.localeCompare(a.date)
      })
  }, [notes, autoMemos, viewMode, layerFilter, impactFilter, searchQuery])

  const impactStats = useMemo(() => ({
    positive: notes.filter(n => n.impact === 'positive').length,
    negative: notes.filter(n => n.impact === 'negative').length,
    neutral: notes.filter(n => n.impact === 'neutral').length,
  }), [notes])

  const timelineGroups = useMemo(() => {
    const groups = {}
    for (const note of allItems) {
      const ym = note.date.slice(0, 7)
      if (!groups[ym]) groups[ym] = []
      groups[ym].push(note)
    }
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
  }, [allItems])

  const monthlyChart = useMemo(() => {
    const map = {}
    for (const note of notes) {
      const ym = note.date.slice(0, 7)
      if (!map[ym]) map[ym] = { month: parseInt(ym.slice(5)) + '月', positive: 0, negative: 0, neutral: 0 }
      map[ym][note.impact]++
    }
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month))
  }, [notes])

  // ─── 学習統計 ──────────────────────────────────────
  const learningStats = useMemo(() => {
    return getLearningStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [learningVersion])

  const CausationTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 6, padding: '8px 12px', fontSize: 11 }}>
        <p style={{ color: '#8b949e', marginBottom: 4 }}>{label}</p>
        {payload.map(p => (<p key={p.dataKey} style={{ color: p.fill }}>{IMPACT_LABELS[p.dataKey]}: <strong>{p.value}</strong></p>))}
      </div>
    )
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-header-left">
          <div className="panel-indicator causation-indicator" />
          <span className="panel-title causation-title">因果関係</span>
          <span className="panel-tag">自動検出 + 手動メモ</span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {autoMemos.length > 0 && (
            <span className="panel-tag" style={{ background: 'rgba(227,179,65,0.15)', color: '#e3b341', border: '1px solid rgba(227,179,65,0.3)' }}>
              {autoMemos.length}件 自動検出
            </span>
          )}
          <span className="panel-tag">{notes.length}件</span>
          <button onClick={() => setShowLearning(v => !v)} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, border: '1px solid rgba(56,139,253,0.3)', background: showLearning ? 'rgba(56,139,253,0.2)' : 'rgba(56,139,253,0.08)', color: '#388bfd', cursor: 'pointer' }}>
            {showLearning ? '✕' : '📊'} 学習
          </button>
          <button onClick={() => setShowForm(v => !v)} style={{ fontSize: 10, padding: '3px 10px', borderRadius: 4, border: '1px solid rgba(210,168,255,0.3)', background: showForm ? 'rgba(210,168,255,0.2)' : 'rgba(210,168,255,0.08)', color: '#d2a8ff', cursor: 'pointer' }}>
            {showForm ? '✕ キャンセル' : '+ メモ追加'}
          </button>
        </div>
      </div>

      <div className="panel-body">
        {/* 学習統計パネル */}
        {showLearning && (
          <div style={{ marginBottom: 12, background: '#0d1117', borderRadius: 8, border: '1px solid #21262d', padding: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#388bfd' }}>学習状況</span>
              <button onClick={handleResetLearning} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3, border: '1px solid #30363d', background: 'transparent', color: '#6e7681', cursor: 'pointer' }}>リセット</button>
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <div style={{ flex: 1, background: '#161b22', borderRadius: 6, padding: '6px 8px', border: '1px solid #21262d' }}>
                <div style={{ fontSize: 9, color: '#6e7681' }}>累計フィードバック</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#e6edf3' }}>{learningStats.totalFeedback}</div>
              </div>
              <div style={{ flex: 1, background: '#161b22', borderRadius: 6, padding: '6px 8px', border: '1px solid #21262d' }}>
                <div style={{ fontSize: 9, color: '#6e7681' }}>精度</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: learningStats.accuracy >= 70 ? '#56d364' : learningStats.accuracy >= 40 ? '#e3b341' : '#f85149' }}>
                  {learningStats.totalFeedback > 0 ? `${learningStats.accuracy}%` : '—'}
                </div>
              </div>
              <div style={{ flex: 1, background: '#161b22', borderRadius: 6, padding: '6px 8px', border: '1px solid #21262d' }}>
                <div style={{ fontSize: 9, color: '#56d364' }}>承認</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#56d364' }}>{learningStats.confirmed}</div>
              </div>
              <div style={{ flex: 1, background: '#161b22', borderRadius: 6, padding: '6px 8px', border: '1px solid #21262d' }}>
                <div style={{ fontSize: 9, color: '#f85149' }}>却下</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#f85149' }}>{learningStats.rejected}</div>
              </div>
            </div>

            {/* パターン別の学習重み */}
            <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 4 }}>パターン別 学習重み</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {Object.entries(PATTERN_TYPE_LABELS).map(([key, label]) => {
                const weight = learningStats.patternWeights[key] || 0
                const byPat = learningStats.byPattern[key]
                const cnt = byPat ? byPat.confirmed + byPat.rejected : 0
                return (
                  <div key={key} style={{ background: '#161b22', borderRadius: 4, padding: '3px 6px', border: `1px solid ${PATTERN_TYPE_COLORS[key]}33`, minWidth: 85 }}>
                    <div style={{ fontSize: 9, color: PATTERN_TYPE_COLORS[key], fontWeight: 600 }}>{label}</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: weight >= 0 ? '#56d364' : '#f85149' }}>
                        {weight >= 0 ? '+' : ''}{(weight * 100).toFixed(0)}%
                      </span>
                      <span style={{ fontSize: 9, color: '#484f58' }}>{cnt}件</span>
                    </div>
                    {/* 学習進捗バー */}
                    <div style={{ height: 2, background: '#21262d', borderRadius: 1, marginTop: 2, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.min(100, Math.abs(weight) / 0.35 * 100)}%`,
                        background: weight >= 0 ? '#56d364' : '#f85149',
                        borderRadius: 1,
                        transition: 'width 0.3s',
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 手動メモ追加フォーム */}
        {showForm && (
          <form className="add-note-form" onSubmit={handleAdd} style={{ marginBottom: 12 }}>
            <div className="form-title"><span style={{ color: '#d2a8ff' }}>◆</span> 新規イベントメモ</div>
            <div className="form-row">
              <input type="date" className="form-input" style={{ maxWidth: 130 }} value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} required />
              <input type="text" className="form-input" placeholder="イベント名" value={form.event} onChange={e => setForm(p => ({ ...p, event: e.target.value }))} required />
            </div>
            <div className="form-row">
              <input type="text" className="form-input" placeholder="アプリ/対象" value={form.app} onChange={e => setForm(p => ({ ...p, app: e.target.value }))} />
              <select className="form-select" value={form.layer} onChange={e => setForm(p => ({ ...p, layer: e.target.value }))}>{LAYER_OPTIONS.map(l => <option key={l}>{l}</option>)}</select>
              <select className="form-select" value={form.impact} onChange={e => setForm(p => ({ ...p, impact: e.target.value }))}>{IMPACT_OPTIONS.map(i => (<option key={i} value={i}>{IMPACT_LABELS[i]}</option>))}</select>
            </div>
            <div className="form-row">
              <input type="text" className="form-input" placeholder="観察メモ" value={form.memo} onChange={e => setForm(p => ({ ...p, memo: e.target.value }))} />
              <button type="submit" className="form-submit">保存</button>
            </div>
          </form>
        )}

        <div className="impact-summary-bar">
          {['positive', 'negative', 'neutral'].map(impact => (
            <div key={impact} className="impact-stat" style={{ borderColor: `${IMPACT_COLORS[impact]}33` }}>
              <ImpactDot impact={impact} />
              <span style={{ color: IMPACT_COLORS[impact], fontWeight: 600 }}>{impactStats[impact]}</span>
              <span style={{ color: '#6e7681' }}>{IMPACT_LABELS[impact]}</span>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 4 }}>月別イベント分布</div>
        <ResponsiveContainer width="100%" height={80}>
          <BarChart data={monthlyChart} margin={{ top: 0, right: 4, bottom: 0, left: -20 }}>
            <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#6e7681' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: '#6e7681' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<CausationTooltip />} />
            <Bar dataKey="positive" stackId="a" fill="#56d364" />
            <Bar dataKey="negative" stackId="a" fill="#f85149" />
            <Bar dataKey="neutral" stackId="a" fill="#e3b341" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>

        {/* フィルター + 表示切替 */}
        <div className="causation-filters">
          <input type="text" className="form-input" placeholder="検索..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ maxWidth: 120, fontSize: 10, padding: '2px 6px' }} />
          <div style={{ display: 'flex', gap: 4 }}>
            {VIEW_MODES.map(mode => (
              <button key={mode} className="causation-filter-btn" onClick={() => setViewMode(mode)} style={{
                borderColor: viewMode === mode ? '#d2a8ff66' : '#30363d',
                background: viewMode === mode ? '#d2a8ff22' : 'transparent',
                color: viewMode === mode ? '#d2a8ff' : '#6e7681',
              }}>{mode}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {['全て', ...LAYER_OPTIONS].map(opt => (
              <button key={opt} className="causation-filter-btn" onClick={() => setLayerFilter(opt)} style={{ borderColor: layerFilter === opt ? (LAYER_COLORS[opt] ?? '#d2a8ff') + '66' : '#30363d', background: layerFilter === opt ? (LAYER_COLORS[opt] ?? '#d2a8ff') + '22' : 'transparent', color: layerFilter === opt ? (LAYER_COLORS[opt] ?? '#d2a8ff') : '#6e7681' }}>{opt}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {['全て', ...IMPACT_OPTIONS].map(opt => (
              <button key={opt} className="causation-filter-btn" onClick={() => setImpactFilter(opt)} style={{ borderColor: impactFilter === opt ? (IMPACT_COLORS[opt] ?? '#d2a8ff') + '66' : '#30363d', background: impactFilter === opt ? (IMPACT_COLORS[opt] ?? '#d2a8ff') + '22' : 'transparent', color: impactFilter === opt ? (IMPACT_COLORS[opt] ?? '#d2a8ff') : '#6e7681' }}>{opt === '全て' ? opt : IMPACT_LABELS[opt] ?? opt}</button>
            ))}
          </div>
        </div>

        {/* ノートリスト */}
        <div className="notes-list" style={{ maxHeight: showForm || showLearning ? 140 : 220, overflowY: 'auto' }}>
          {timelineGroups.map(([ym, groupNotes]) => (
            <div key={ym} className="timeline-group">
              <div className="timeline-month-label">
                {parseInt(ym.slice(5))}月 {ym.slice(0, 4)}
                <span style={{ color: '#484f58', marginLeft: 6 }}>{groupNotes.length}件</span>
              </div>
              {groupNotes.map(note => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onDelete={handleDelete}
                  onConfirm={handleConfirm}
                  onReject={handleReject}
                />
              ))}
            </div>
          ))}
          {allItems.length === 0 && (
            <div style={{ textAlign: 'center', color: '#6e7681', padding: 20, fontSize: 11 }}>
              該当するノートがありません
            </div>
          )}
        </div>
      </div>
      <div className="panel-footer">
        自動検出 + 手動記録 — フィードバックで精度向上
        {learningStats.totalFeedback > 0 && (
          <span style={{ marginLeft: 8, color: '#388bfd' }}>
            (学習済: {learningStats.totalFeedback}件 / 精度: {learningStats.accuracy}%)
          </span>
        )}
      </div>
    </div>
  )
})

// ─── ノートカード コンポーネント ──────────────────────────
const NoteCard = memo(function NoteCard({ note, onDelete, onConfirm, onReject }) {
  const isAuto = note._source === 'auto'
  const isAutoConfirmed = note._source === 'auto_confirmed' || note.autoConfirmed

  return (
    <div className={`note-card ${note.impact}`} style={isAuto ? {
      borderLeft: `3px solid ${PATTERN_TYPE_COLORS[note.patternType] || '#e3b341'}`,
      background: 'rgba(227,179,65,0.04)',
    } : isAutoConfirmed ? {
      borderLeft: '3px solid #56d364',
      background: 'rgba(86,211,100,0.04)',
    } : undefined}>
      <div className="note-header">
        <span className="note-date">{note.date.slice(5)}</span>
        <span className={`note-layer-badge layer-${note.layer}`}>{note.layer}</span>
        <span style={{ fontSize: 10, color: '#6e7681' }}>
          <ImpactDot impact={note.impact} />{IMPACT_LABELS[note.impact]}
        </span>

        {/* 自動メモ識別バッジ */}
        {isAuto && (
          <span style={{
            fontSize: 8, padding: '1px 5px', borderRadius: 3, fontWeight: 600,
            background: `${PATTERN_TYPE_COLORS[note.patternType]}22`,
            color: PATTERN_TYPE_COLORS[note.patternType],
            border: `1px solid ${PATTERN_TYPE_COLORS[note.patternType]}44`,
          }}>
            AI {PATTERN_TYPE_LABELS[note.patternType] || '自動'}
          </span>
        )}
        {isAutoConfirmed && (
          <span style={{
            fontSize: 8, padding: '1px 5px', borderRadius: 3, fontWeight: 600,
            background: 'rgba(86,211,100,0.15)', color: '#56d364',
            border: '1px solid rgba(86,211,100,0.3)',
          }}>
            AI承認済
          </span>
        )}

        {/* 信頼度バッジ (自動メモのみ) */}
        {isAuto && note.confidence != null && (
          <span style={{
            fontSize: 8, padding: '1px 4px', borderRadius: 3,
            background: note.confidence >= 0.7 ? 'rgba(86,211,100,0.12)' : note.confidence >= 0.4 ? 'rgba(227,179,65,0.12)' : 'rgba(248,81,73,0.12)',
            color: note.confidence >= 0.7 ? '#56d364' : note.confidence >= 0.4 ? '#e3b341' : '#f85149',
          }}>
            {(note.confidence * 100).toFixed(0)}%
          </span>
        )}

        {/* アクションボタン */}
        {isAuto ? (
          <div style={{ display: 'flex', gap: 3, marginLeft: 'auto' }}>
            <button onClick={() => onConfirm(note)} title="承認" style={{
              fontSize: 10, padding: '1px 6px', borderRadius: 3, cursor: 'pointer',
              border: '1px solid rgba(86,211,100,0.4)', background: 'rgba(86,211,100,0.1)', color: '#56d364',
            }}>&#10003;</button>
            <button onClick={() => onReject(note)} title="却下" style={{
              fontSize: 10, padding: '1px 6px', borderRadius: 3, cursor: 'pointer',
              border: '1px solid rgba(248,81,73,0.4)', background: 'rgba(248,81,73,0.1)', color: '#f85149',
            }}>&#10005;</button>
          </div>
        ) : (
          <button className="note-delete-btn" onClick={() => onDelete(note.id)} title="削除">&#10005;</button>
        )}
      </div>
      <div className="note-event">{note.event}</div>
      {note.app && <div className="note-app">対象: {note.app}</div>}
      {note.memo && <div className="note-memo">{note.memo}</div>}
      {/* シグナルタグ (自動メモのみ) */}
      {isAuto && note.signals?.length > 0 && (
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 3 }}>
          {note.signals.map(sig => (
            <span key={sig} style={{ fontSize: 8, padding: '0 4px', borderRadius: 2, background: '#21262d', color: '#6e7681', border: '1px solid #30363d' }}>
              {sig}
            </span>
          ))}
        </div>
      )}
    </div>
  )
})
