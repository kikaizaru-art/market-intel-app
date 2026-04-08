import { useState, useMemo } from 'react'
import initialNotes from '../../../data/mock/causation-notes.json'

const LAYER_OPTIONS = ['マクロ', '競合', 'ユーザー']
const IMPACT_OPTIONS = ['positive', 'negative', 'neutral']
const IMPACT_LABELS = { positive: '好影響', negative: '悪影響', neutral: '中立' }
const IMPACT_COLORS = { positive: '#56d364', negative: '#f85149', neutral: '#e3b341' }
const LAYER_COLORS = { 'マクロ': '#388bfd', '競合': '#f85149', 'ユーザー': '#56d364' }

function ImpactDot({ impact }) {
  return (
    <span style={{
      display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
      background: IMPACT_COLORS[impact], marginRight: 4,
    }} />
  )
}

export default function CausationView() {
  const [notes, setNotes] = useState(initialNotes.notes)
  const [form, setForm] = useState({
    date: '', event: '', app: '', layer: 'マクロ', impact: 'neutral', memo: '',
  })
  const [showForm, setShowForm] = useState(false)
  const [layerFilter, setLayerFilter] = useState('全て')
  const [impactFilter, setImpactFilter] = useState('全て')
  const [searchQuery, setSearchQuery] = useState('')

  function handleAdd(e) {
    e.preventDefault()
    if (!form.date || !form.event) return
    const newNote = {
      id: `note_${Date.now()}`,
      ...form,
    }
    setNotes(prev => [newNote, ...prev])
    setForm({ date: '', event: '', app: '', layer: 'マクロ', impact: 'neutral', memo: '' })
    setShowForm(false)
  }

  function handleDelete(id) {
    setNotes(prev => prev.filter(n => n.id !== id))
  }

  // フィルタリング
  const filtered = useMemo(() => {
    return [...notes]
      .filter(n => layerFilter === '全て' || n.layer === layerFilter)
      .filter(n => impactFilter === '全て' || n.impact === impactFilter)
      .filter(n => {
        if (!searchQuery) return true
        const q = searchQuery.toLowerCase()
        return n.event.toLowerCase().includes(q)
          || (n.app && n.app.toLowerCase().includes(q))
          || (n.memo && n.memo.toLowerCase().includes(q))
      })
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [notes, layerFilter, impactFilter, searchQuery])

  // インパクト集計
  const impactStats = useMemo(() => ({
    positive: notes.filter(n => n.impact === 'positive').length,
    negative: notes.filter(n => n.impact === 'negative').length,
    neutral: notes.filter(n => n.impact === 'neutral').length,
  }), [notes])

  // タイムラインの月グループ化
  const timelineGroups = useMemo(() => {
    const groups = {}
    for (const note of filtered) {
      const ym = note.date.slice(0, 7)
      if (!groups[ym]) groups[ym] = []
      groups[ym].push(note)
    }
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtered])

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-header-left">
          <div className="panel-indicator causation-indicator" />
          <span className="panel-title causation-title">因果関係</span>
          <span className="panel-tag">イベント × データ突合せ</span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span className="panel-tag">{notes.length}件</span>
          <button
            onClick={() => setShowForm(v => !v)}
            style={{
              fontSize: 10, padding: '3px 10px', borderRadius: 4,
              border: '1px solid rgba(210,168,255,0.3)',
              background: showForm ? 'rgba(210,168,255,0.2)' : 'rgba(210,168,255,0.08)',
              color: '#d2a8ff', cursor: 'pointer',
            }}
          >
            {showForm ? '✕ キャンセル' : '+ メモ追加'}
          </button>
        </div>
      </div>

      <div className="panel-body">
        {/* 追加フォーム */}
        {showForm && (
          <form className="add-note-form" onSubmit={handleAdd} style={{ marginBottom: 12 }}>
            <div className="form-title">
              <span style={{ color: '#d2a8ff' }}>◆</span> 新規イベントメモ
            </div>
            <div className="form-row">
              <input
                type="date"
                className="form-input"
                style={{ maxWidth: 130 }}
                value={form.date}
                onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                required
              />
              <input
                type="text"
                className="form-input"
                placeholder="イベント名（例: 大型アップデートv3.0）"
                value={form.event}
                onChange={e => setForm(p => ({ ...p, event: e.target.value }))}
                required
              />
            </div>
            <div className="form-row">
              <input
                type="text"
                className="form-input"
                placeholder="アプリ/対象（例: パズルゲームX）"
                value={form.app}
                onChange={e => setForm(p => ({ ...p, app: e.target.value }))}
              />
              <select
                className="form-select"
                value={form.layer}
                onChange={e => setForm(p => ({ ...p, layer: e.target.value }))}
              >
                {LAYER_OPTIONS.map(l => <option key={l}>{l}</option>)}
              </select>
              <select
                className="form-select"
                value={form.impact}
                onChange={e => setForm(p => ({ ...p, impact: e.target.value }))}
              >
                {IMPACT_OPTIONS.map(i => (
                  <option key={i} value={i}>{IMPACT_LABELS[i]}</option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <input
                type="text"
                className="form-input"
                placeholder="観察メモ（例: インストール数が翌週+30%）"
                value={form.memo}
                onChange={e => setForm(p => ({ ...p, memo: e.target.value }))}
              />
              <button type="submit" className="form-submit">保存</button>
            </div>
          </form>
        )}

        {/* インパクト集計バー */}
        <div className="impact-summary-bar">
          {['positive', 'negative', 'neutral'].map(impact => (
            <div
              key={impact}
              className="impact-stat"
              style={{ borderColor: `${IMPACT_COLORS[impact]}33` }}
            >
              <ImpactDot impact={impact} />
              <span style={{ color: IMPACT_COLORS[impact], fontWeight: 600 }}>{impactStats[impact]}</span>
              <span style={{ color: '#6e7681' }}>{IMPACT_LABELS[impact]}</span>
            </div>
          ))}
        </div>

        {/* フィルター */}
        <div className="causation-filters">
          <input
            type="text"
            className="form-input"
            placeholder="検索..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ maxWidth: 120, fontSize: 10, padding: '2px 6px' }}
          />
          <div style={{ display: 'flex', gap: 4 }}>
            {['全て', ...LAYER_OPTIONS].map(opt => (
              <button
                key={opt}
                className="causation-filter-btn"
                onClick={() => setLayerFilter(opt)}
                style={{
                  borderColor: layerFilter === opt ? (LAYER_COLORS[opt] ?? '#d2a8ff') + '66' : '#30363d',
                  background: layerFilter === opt ? (LAYER_COLORS[opt] ?? '#d2a8ff') + '22' : 'transparent',
                  color: layerFilter === opt ? (LAYER_COLORS[opt] ?? '#d2a8ff') : '#6e7681',
                }}
              >
                {opt}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {['全て', ...IMPACT_OPTIONS].map(opt => (
              <button
                key={opt}
                className="causation-filter-btn"
                onClick={() => setImpactFilter(opt)}
                style={{
                  borderColor: impactFilter === opt ? (IMPACT_COLORS[opt] ?? '#d2a8ff') + '66' : '#30363d',
                  background: impactFilter === opt ? (IMPACT_COLORS[opt] ?? '#d2a8ff') + '22' : 'transparent',
                  color: impactFilter === opt ? (IMPACT_COLORS[opt] ?? '#d2a8ff') : '#6e7681',
                }}
              >
                {opt === '全て' ? opt : IMPACT_LABELS[opt] ?? opt}
              </button>
            ))}
          </div>
        </div>

        {/* タイムラインノート一覧 */}
        <div className="notes-list" style={{ maxHeight: showForm ? 140 : 220, overflowY: 'auto' }}>
          {timelineGroups.map(([ym, groupNotes]) => (
            <div key={ym} className="timeline-group">
              <div className="timeline-month-label">
                {parseInt(ym.slice(5))}月 {ym.slice(0, 4)}
                <span style={{ color: '#484f58', marginLeft: 6 }}>{groupNotes.length}件</span>
              </div>
              {groupNotes.map(note => (
                <div key={note.id} className={`note-card ${note.impact}`}>
                  <div className="note-header">
                    <span className="note-date">{note.date.slice(5)}</span>
                    <span className={`note-layer-badge layer-${note.layer}`}>{note.layer}</span>
                    <span style={{ fontSize: 10, color: '#6e7681' }}>
                      <ImpactDot impact={note.impact} />
                      {IMPACT_LABELS[note.impact]}
                    </span>
                    <button
                      className="note-delete-btn"
                      onClick={() => handleDelete(note.id)}
                      title="削除"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="note-event">{note.event}</div>
                  {note.app && <div className="note-app">対象: {note.app}</div>}
                  {note.memo && <div className="note-memo">{note.memo}</div>}
                </div>
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
        手動記録 — Phase 3でLLMによる自動サマリー生成を予定
      </div>
    </div>
  )
}
