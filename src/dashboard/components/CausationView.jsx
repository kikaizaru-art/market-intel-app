import { useState, useMemo, useEffect, useCallback, memo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { ChartTooltip, ImpactDot } from './shared/index.js'
import {
  IMPACT_LABELS, IMPACT_COLORS, LAYER_COLORS,
  PATTERN_TYPE_LABELS, PATTERN_TYPE_COLORS,
} from '../constants.js'
import { generateAutoMemos, validateAutoMemos } from '../../analyzers/autoMemo.js'
import {
  getPatternWeights, getLearningStats, recordBatchFeedback,
  recordFeedback, resetLearning, getUserSettings,
} from '../services/patternStore.js'
import LearningSettings from './LearningSettings.jsx'

const LAYER_OPTIONS = ['マクロ', '競合', 'ユーザー']
const IMPACT_OPTIONS = ['positive', 'negative', 'neutral']

export default memo(function CausationView({
  data: initialData,
  trendsData,
  reviewsData,
  eventsData,
  newsData,
}) {
  const [manualNotes, setManualNotes] = useState(initialData.notes)
  const [autoConfirmed, setAutoConfirmed] = useState([])
  const [autoRejectedCount, setAutoRejectedCount] = useState(0)
  const [form, setForm] = useState({ date: '', event: '', app: '', layer: 'マクロ', impact: 'neutral', memo: '' })
  const [showForm, setShowForm] = useState(false)
  const [layerFilter, setLayerFilter] = useState('全て')
  const [impactFilter, setImpactFilter] = useState('全て')
  const [searchQuery, setSearchQuery] = useState('')
  const [showLearning, setShowLearning] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [learningVersion, setLearningVersion] = useState(0)
  const [settingsVersion, setSettingsVersion] = useState(0)

  // ─── 自動メモ生成 + 自動検証 ──────────────────────
  const runAutoMemo = useCallback(() => {
    const weights = getPatternWeights()
    const settings = getUserSettings()
    const memos = generateAutoMemos({
      trendsData,
      reviewsData,
      eventsData,
      newsData,
      existingNotes: manualNotes,
      patternWeights: weights,
      currentDate: new Date().toISOString().slice(0, 10),
      settings,
    })

    // データ照合で自動承認/却下を判定
    const { confirmed, rejected } = validateAutoMemos(memos, { trendsData, reviewsData }, settings)

    // 学習ストアに一括記録
    recordBatchFeedback(confirmed, rejected)

    // 承認済みメモをノートに追加
    const confirmedNotes = confirmed.map(m => ({
      id: m.id,
      date: m.date,
      event: m.event,
      app: m.app,
      layer: m.layer,
      impact: m.impact,
      memo: m.memo,
      auto: true,
      patternType: m.patternType,
      confidence: m.confidence,
      validationResult: m.validationResult,
    }))

    setAutoConfirmed(confirmedNotes)
    setAutoRejectedCount(rejected.length)
    setLearningVersion(v => v + 1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trendsData, reviewsData, eventsData, newsData, manualNotes, settingsVersion])

  useEffect(() => {
    runAutoMemo()
  }, [runAutoMemo])

  const handleSettingsChange = useCallback(() => {
    setSettingsVersion(v => v + 1)
  }, [])

  // ─── ハンドラー ────────────────────────────────────
  function handleAdd(e) {
    e.preventDefault()
    if (!form.date || !form.event) return
    setManualNotes(prev => [{ id: `note_${Date.now()}`, ...form }, ...prev])
    setForm({ date: '', event: '', app: '', layer: 'マクロ', impact: 'neutral', memo: '' })
    setShowForm(false)
  }

  function handleDelete(id) {
    setManualNotes(prev => prev.filter(n => n.id !== id))
    setAutoConfirmed(prev => prev.filter(m => m.id !== id))
  }

  function handleManualReject(autoNote) {
    // 手動オーバーライド: 自動承認されたメモを却下
    recordFeedback('rejected', autoNote, 'manual')
    setAutoConfirmed(prev => prev.filter(m => m.id !== autoNote.id))
    setLearningVersion(v => v + 1)
  }

  function handleResetLearning() {
    resetLearning()
    setLearningVersion(v => v + 1)
    runAutoMemo()
  }

  // ─── 統合リスト ────────────────────────────────────
  const allNotes = useMemo(() => {
    const manual = manualNotes.map(n => ({ ...n, _source: 'manual' }))
    const auto = autoConfirmed.map(n => ({ ...n, _source: 'auto' }))
    return [...auto, ...manual]
  }, [manualNotes, autoConfirmed])

  const filtered = useMemo(() =>
    allNotes
      .filter(n => layerFilter === '全て' || n.layer === layerFilter)
      .filter(n => impactFilter === '全て' || n.impact === impactFilter)
      .filter(n => {
        if (!searchQuery) return true
        const q = searchQuery.toLowerCase()
        return n.event.toLowerCase().includes(q) || (n.app && n.app.toLowerCase().includes(q)) || (n.memo && n.memo.toLowerCase().includes(q))
      })
      .sort((a, b) => b.date.localeCompare(a.date)),
    [allNotes, layerFilter, impactFilter, searchQuery])

  const impactStats = useMemo(() => ({
    positive: allNotes.filter(n => n.impact === 'positive').length,
    negative: allNotes.filter(n => n.impact === 'negative').length,
    neutral: allNotes.filter(n => n.impact === 'neutral').length,
  }), [allNotes])

  const timelineGroups = useMemo(() => {
    const groups = {}
    for (const note of filtered) {
      const ym = note.date.slice(0, 7)
      if (!groups[ym]) groups[ym] = []
      groups[ym].push(note)
    }
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtered])

  const monthlyChart = useMemo(() => {
    const map = {}
    for (const note of allNotes) {
      const ym = note.date.slice(0, 7)
      if (!map[ym]) map[ym] = { month: parseInt(ym.slice(5)) + '月', positive: 0, negative: 0, neutral: 0 }
      map[ym][note.impact]++
    }
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month))
  }, [allNotes])

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
          <span className="panel-tag">自動検出・自動学習</span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {autoConfirmed.length > 0 && (
            <span className="panel-tag" style={{ background: 'rgba(86,211,100,0.15)', color: '#56d364', border: '1px solid rgba(86,211,100,0.3)' }}>
              {autoConfirmed.length}件 自動承認
            </span>
          )}
          {autoRejectedCount > 0 && (
            <span className="panel-tag" style={{ background: 'rgba(248,81,73,0.1)', color: '#f85149', border: '1px solid rgba(248,81,73,0.25)' }}>
              {autoRejectedCount}件 自動却下
            </span>
          )}
          <span className="panel-tag">{allNotes.length}件</span>
          <button onClick={() => { setShowSettings(v => !v); if (!showSettings) setShowLearning(false) }} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, border: '1px solid rgba(210,168,255,0.3)', background: showSettings ? 'rgba(210,168,255,0.2)' : 'rgba(210,168,255,0.08)', color: '#d2a8ff', cursor: 'pointer' }}>
            {showSettings ? '✕' : '⚙'} 設定
          </button>
          <button onClick={() => { setShowLearning(v => !v); if (!showLearning) setShowSettings(false) }} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, border: '1px solid rgba(56,139,253,0.3)', background: showLearning ? 'rgba(56,139,253,0.2)' : 'rgba(56,139,253,0.08)', color: '#388bfd', cursor: 'pointer' }}>
            {showLearning ? '✕' : '📊'} 学習
          </button>
          <button onClick={() => setShowForm(v => !v)} style={{ fontSize: 10, padding: '3px 10px', borderRadius: 4, border: '1px solid rgba(210,168,255,0.3)', background: showForm ? 'rgba(210,168,255,0.2)' : 'rgba(210,168,255,0.08)', color: '#d2a8ff', cursor: 'pointer' }}>
            {showForm ? '✕ キャンセル' : '+ メモ追加'}
          </button>
        </div>
      </div>

      <div className="panel-body">
        {/* 学習カスタマイズパネル */}
        {showSettings && (
          <LearningSettings onSettingsChange={handleSettingsChange} />
        )}

        {/* 学習統計パネル */}
        {showLearning && (
          <div style={{ marginBottom: 12, background: '#0d1117', borderRadius: 8, border: '1px solid #21262d', padding: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#388bfd' }}>自動学習状況</span>
              <button onClick={handleResetLearning} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3, border: '1px solid #30363d', background: 'transparent', color: '#6e7681', cursor: 'pointer' }}>リセット</button>
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <div style={{ flex: 1, background: '#161b22', borderRadius: 6, padding: '6px 8px', border: '1px solid #21262d' }}>
                <div style={{ fontSize: 9, color: '#6e7681' }}>累計検証数</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#e6edf3' }}>{learningStats.totalFeedback}</div>
              </div>
              <div style={{ flex: 1, background: '#161b22', borderRadius: 6, padding: '6px 8px', border: '1px solid #21262d' }}>
                <div style={{ fontSize: 9, color: '#6e7681' }}>的中率</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: learningStats.accuracy >= 70 ? '#56d364' : learningStats.accuracy >= 40 ? '#e3b341' : '#f85149' }}>
                  {learningStats.totalFeedback > 0 ? `${learningStats.accuracy}%` : '—'}
                </div>
              </div>
              <div style={{ flex: 1, background: '#161b22', borderRadius: 6, padding: '6px 8px', border: '1px solid #21262d' }}>
                <div style={{ fontSize: 9, color: '#56d364' }}>的中</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#56d364' }}>{learningStats.confirmed}</div>
              </div>
              <div style={{ flex: 1, background: '#161b22', borderRadius: 6, padding: '6px 8px', border: '1px solid #21262d' }}>
                <div style={{ fontSize: 9, color: '#f85149' }}>外れ</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#f85149' }}>{learningStats.rejected}</div>
              </div>
            </div>

            <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 4 }}>パターン別 学習重み</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {Object.entries(PATTERN_TYPE_LABELS).map(([key, label]) => {
                const weight = learningStats.patternWeights[key] || 0
                const byPat = learningStats.byPattern[key]
                const cnt = byPat ? byPat.confirmed + byPat.rejected : 0
                const patAccuracy = byPat && cnt > 0 ? Math.round((byPat.confirmed / cnt) * 100) : null
                return (
                  <div key={key} style={{ background: '#161b22', borderRadius: 4, padding: '3px 6px', border: `1px solid ${PATTERN_TYPE_COLORS[key]}33`, minWidth: 85 }}>
                    <div style={{ fontSize: 9, color: PATTERN_TYPE_COLORS[key], fontWeight: 600 }}>{label}</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: weight >= 0 ? '#56d364' : '#f85149' }}>
                        {weight >= 0 ? '+' : ''}{(weight * 100).toFixed(0)}%
                      </span>
                      {patAccuracy !== null && (
                        <span style={{ fontSize: 9, color: patAccuracy >= 60 ? '#56d364' : '#f85149' }}>
                          的中{patAccuracy}%
                        </span>
                      )}
                      <span style={{ fontSize: 9, color: '#484f58' }}>{cnt}件</span>
                    </div>
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

            <div style={{ marginTop: 8, fontSize: 9, color: '#484f58', lineHeight: 1.5 }}>
              データ更新の度に自動検証が走り、的中/外れを学習します。
              蓄積するほどパターン別の信頼度重みが最適化され、不要なメモは自動却下されます。
            </div>
          </div>
        )}

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

        <div className="causation-filters">
          <input type="text" className="form-input" placeholder="検索..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ maxWidth: 120, fontSize: 10, padding: '2px 6px' }} />
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

        <div className="notes-list" style={{ maxHeight: showForm || showLearning || showSettings ? 140 : 220, overflowY: 'auto' }}>
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
                  onManualReject={handleManualReject}
                />
              ))}
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', color: '#6e7681', padding: 20, fontSize: 11 }}>
              該当するノートがありません
            </div>
          )}
        </div>
      </div>
      <div className="panel-footer">
        自動検出・自動検証・自動学習
        {learningStats.totalFeedback > 0 && (
          <span style={{ marginLeft: 8, color: '#388bfd' }}>
            (学習{learningStats.totalFeedback}件 / 的中率{learningStats.accuracy}%)
          </span>
        )}
      </div>
    </div>
  )
})

// ─── ノートカード ────────────────────────────────────────
const VALIDATION_LABELS = {
  data_verified: 'データ検証済',
  confidence_threshold: '信頼度判定',
  auto_threshold: '閾値判定',
}

const NoteCard = memo(function NoteCard({ note, onDelete, onManualReject }) {
  const isAuto = note._source === 'auto'

  return (
    <div className={`note-card ${note.impact}`} style={isAuto ? {
      borderLeft: `3px solid ${PATTERN_TYPE_COLORS[note.patternType] || '#56d364'}`,
      background: 'rgba(86,211,100,0.03)',
    } : undefined}>
      <div className="note-header">
        <span className="note-date">{note.date.slice(5)}</span>
        <span className={`note-layer-badge layer-${note.layer}`}>{note.layer}</span>
        <span style={{ fontSize: 10, color: '#6e7681' }}>
          <ImpactDot impact={note.impact} />{IMPACT_LABELS[note.impact]}
        </span>

        {isAuto && (
          <>
            <span style={{
              fontSize: 8, padding: '1px 5px', borderRadius: 3, fontWeight: 600,
              background: `${PATTERN_TYPE_COLORS[note.patternType]}22`,
              color: PATTERN_TYPE_COLORS[note.patternType],
              border: `1px solid ${PATTERN_TYPE_COLORS[note.patternType]}44`,
            }}>
              AI {PATTERN_TYPE_LABELS[note.patternType] || '自動'}
            </span>
            {note.confidence != null && (
              <span style={{
                fontSize: 8, padding: '1px 4px', borderRadius: 3,
                background: note.confidence >= 0.7 ? 'rgba(86,211,100,0.12)' : 'rgba(227,179,65,0.12)',
                color: note.confidence >= 0.7 ? '#56d364' : '#e3b341',
              }}>
                {(note.confidence * 100).toFixed(0)}%
              </span>
            )}
            {note.validationResult && (
              <span style={{ fontSize: 8, padding: '1px 4px', borderRadius: 3, background: 'rgba(56,139,253,0.12)', color: '#388bfd' }}>
                {VALIDATION_LABELS[note.validationResult] || note.validationResult}
              </span>
            )}
          </>
        )}

        {/* 自動メモには手動オーバーライド(却下)ボタン、手動メモには削除ボタン */}
        {isAuto ? (
          <button onClick={() => onManualReject(note)} title="手動却下（学習に反映）" style={{
            fontSize: 9, padding: '1px 5px', borderRadius: 3, cursor: 'pointer', marginLeft: 'auto',
            border: '1px solid rgba(248,81,73,0.3)', background: 'transparent', color: '#6e7681',
          }}>&#10005;</button>
        ) : (
          <button className="note-delete-btn" onClick={() => onDelete(note.id)} title="削除">&#10005;</button>
        )}
      </div>
      <div className="note-event">{note.event}</div>
      {note.app && <div className="note-app">対象: {note.app}</div>}
      {note.memo && <div className="note-memo">{note.memo}</div>}
    </div>
  )
})
