import { useState, useCallback, memo } from 'react'
import { useDomain } from '../context/DomainContext.jsx'
import { useTarget } from '../context/TargetContext.jsx'
import { QUICK_EVENT_PRESETS, IMPACT_LABELS } from '../constants.js'

const IMPACT_OPTIONS = [
  { key: 'positive', label: '好影響', color: '#56d364' },
  { key: 'negative', label: '悪影響', color: '#f85149' },
  { key: 'neutral',  label: '中立',   color: '#e3b341' },
]

/**
 * イベントクイック入力 — ワンタップ + メモ + 自由記帳
 *
 * 「自分が何をしたか」を最小限の手間で記録し、因果ログに組み込む。
 * ドメインに応じた選択肢を表示し、1タップで記録可能。
 */
export default memo(function EventQuickInput({ onAddNote }) {
  const { domainId } = useDomain()
  const { target } = useTarget()

  const presets = QUICK_EVENT_PRESETS[domainId] || QUICK_EVENT_PRESETS._default

  const today = new Date().toISOString().slice(0, 10)
  const [selected, setSelected] = useState(null)
  const [date, setDate] = useState(today)
  const [memo, setMemo] = useState('')
  const [impact, setImpact] = useState(null) // null = use preset default
  const [freeText, setFreeText] = useState('')
  const [showFreeForm, setShowFreeForm] = useState(false)
  const [saved, setSaved] = useState(false)

  const reset = useCallback(() => {
    setSelected(null)
    setDate(new Date().toISOString().slice(0, 10))
    setMemo('')
    setImpact(null)
    setFreeText('')
    setShowFreeForm(false)
  }, [])

  const handleSave = useCallback((preset) => {
    const p = preset || presets.find(p => p.key === selected)
    if (!p) return

    const finalImpact = impact || p.impact
    const note = {
      id: `quick_${Date.now()}`,
      date,
      event: memo ? `${p.label}: ${memo}` : p.label,
      app: target?.appName || '',
      layer: p.layer,
      impact: finalImpact,
      memo: memo || '',
      quickInput: true,
      eventType: p.key,
    }
    onAddNote(note)
    reset()
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }, [selected, date, memo, impact, presets, target, onAddNote, reset])

  const handleFreeFormSave = useCallback(() => {
    if (!freeText.trim()) return
    const note = {
      id: `quick_${Date.now()}`,
      date,
      event: freeText.trim(),
      app: target?.appName || '',
      layer: 'ユーザー',
      impact: impact || 'neutral',
      memo: memo || '',
      quickInput: true,
      eventType: 'free',
    }
    onAddNote(note)
    reset()
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }, [freeText, date, memo, impact, target, onAddNote, reset])

  const handlePresetClick = useCallback((preset) => {
    if (selected === preset.key) {
      // Same button clicked again → save immediately with defaults
      handleSave(preset)
    } else {
      setSelected(preset.key)
      setImpact(null)
    }
  }, [selected, handleSave])

  return (
    <div className="quick-event-input">
      <div className="quick-event-header">
        <span className="quick-event-title">
          施策を記録
        </span>
        <span className="quick-event-hint">
          {saved ? '保存しました' : selected ? 'もう一度タップで即保存 / 下で詳細入力' : 'タップで選択'}
        </span>
      </div>

      {/* Stage 1: Quick-select buttons */}
      <div className="quick-event-buttons">
        {presets.map(p => (
          <button
            key={p.key}
            onClick={() => handlePresetClick(p)}
            className={`quick-event-btn ${selected === p.key ? 'active' : ''}`}
          >
            <span className="quick-event-btn-icon">{p.icon}</span>
            <span className="quick-event-btn-label">{p.label}</span>
          </button>
        ))}
        <button
          onClick={() => { setShowFreeForm(v => !v); setSelected(null) }}
          className={`quick-event-btn ${showFreeForm ? 'active' : ''}`}
          style={{ borderStyle: 'dashed' }}
        >
          <span className="quick-event-btn-icon">+</span>
          <span className="quick-event-btn-label">自由記帳</span>
        </button>
      </div>

      {/* Stage 2: Detail input (shown when a preset is selected) */}
      {selected && (
        <div className="quick-event-detail">
          <div className="quick-event-detail-row">
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="quick-event-date"
            />
            <div className="quick-event-impact-btns">
              {IMPACT_OPTIONS.map(opt => {
                const preset = presets.find(p => p.key === selected)
                const isActive = impact ? impact === opt.key : preset?.impact === opt.key
                return (
                  <button
                    key={opt.key}
                    onClick={() => setImpact(opt.key)}
                    className="quick-event-impact-btn"
                    style={{
                      borderColor: isActive ? opt.color : undefined,
                      background: isActive ? `${opt.color}22` : undefined,
                      color: isActive ? opt.color : undefined,
                    }}
                    title={opt.label}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="quick-event-detail-row">
            <input
              type="text"
              value={memo}
              onChange={e => setMemo(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
              placeholder="補足メモ（省略可）例: v2.3.1 課金周りのバグ修正"
              className="quick-event-memo"
            />
            <button onClick={() => handleSave()} className="quick-event-save-btn">
              保存
            </button>
            <button onClick={reset} className="quick-event-cancel-btn">
              取消
            </button>
          </div>
        </div>
      )}

      {/* Stage 3: Free-form input */}
      {showFreeForm && (
        <div className="quick-event-detail">
          <div className="quick-event-detail-row">
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="quick-event-date"
            />
            <div className="quick-event-impact-btns">
              {IMPACT_OPTIONS.map(opt => {
                const isActive = (impact || 'neutral') === opt.key
                return (
                  <button
                    key={opt.key}
                    onClick={() => setImpact(opt.key)}
                    className="quick-event-impact-btn"
                    style={{
                      borderColor: isActive ? opt.color : undefined,
                      background: isActive ? `${opt.color}22` : undefined,
                      color: isActive ? opt.color : undefined,
                    }}
                    title={opt.label}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="quick-event-detail-row">
            <input
              type="text"
              value={freeText}
              onChange={e => setFreeText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleFreeFormSave() }}
              placeholder="イベント内容を入力 例: 競合がTVCM開始した"
              className="quick-event-memo"
              autoFocus
            />
          </div>
          <div className="quick-event-detail-row">
            <input
              type="text"
              value={memo}
              onChange={e => setMemo(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleFreeFormSave() }}
              placeholder="補足メモ（省略可）"
              className="quick-event-memo"
            />
            <button
              onClick={handleFreeFormSave}
              disabled={!freeText.trim()}
              className="quick-event-save-btn"
            >
              保存
            </button>
            <button onClick={reset} className="quick-event-cancel-btn">
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  )
})
