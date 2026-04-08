import { useState } from 'react'
import initialNotes from '../../../data/mock/causation-notes.json'

const LAYER_OPTIONS = ['マクロ', '競合', 'ユーザー']
const IMPACT_OPTIONS = ['positive', 'negative', 'neutral']
const IMPACT_LABELS = { positive: '好影響', negative: '悪影響', neutral: '中立' }

function ImpactDot({ impact }) {
  const colors = { positive: '#56d364', negative: '#f85149', neutral: '#e3b341' }
  return (
    <span style={{
      display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
      background: colors[impact], marginRight: 4,
    }} />
  )
}

export default function CausationView() {
  const [notes, setNotes] = useState(initialNotes.notes)
  const [form, setForm] = useState({
    date: '', event: '', app: '', layer: 'マクロ', impact: 'neutral', memo: '',
  })
  const [showForm, setShowForm] = useState(false)

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

  const sorted = [...notes].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-header-left">
          <div className="panel-indicator causation-indicator" />
          <span className="panel-title causation-title">因果関係</span>
          <span className="panel-tag">イベント × データ突合せ</span>
        </div>
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

        {/* ノート一覧 */}
        <div className="notes-list" style={{ maxHeight: showForm ? 180 : 290, overflowY: 'auto' }}>
          {sorted.map(note => (
            <div key={note.id} className={`note-card ${note.impact}`}>
              <div className="note-header">
                <span className="note-date">{note.date}</span>
                <span className={`note-layer-badge layer-${note.layer}`}>{note.layer}</span>
                <span style={{ fontSize: 10, color: '#6e7681' }}>
                  <ImpactDot impact={note.impact} />
                  {IMPACT_LABELS[note.impact]}
                </span>
              </div>
              <div className="note-event">{note.event}</div>
              {note.app && <div className="note-app">対象: {note.app}</div>}
              {note.memo && <div className="note-memo">{note.memo}</div>}
            </div>
          ))}
        </div>
      </div>

      <div className="panel-footer">
        手動記録 — Phase 3でLLMによる自動サマリー生成を予定
      </div>
    </div>
  )
}
