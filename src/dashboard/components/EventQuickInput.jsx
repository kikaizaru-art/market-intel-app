import { useState, useCallback, useMemo, memo } from 'react'
import { useDomain } from '../context/DomainContext.jsx'
import { useTarget } from '../context/TargetContext.jsx'
import {
  QUICK_EVENT_PRESETS,
  MEDIA_OPTIONS,
  REGION_OPTIONS,
  LANE_LABELS,
  LANE_COLORS,
} from '../constants.js'

const IMPACT_OPTIONS = [
  { key: 'positive', label: '好影響', color: '#56d364' },
  { key: 'negative', label: '悪影響', color: '#f85149' },
  { key: 'neutral',  label: '中立',   color: '#e3b341' },
]

/**
 * イベントクイック入力 — プロダクト/マーケ2レーン + 媒体/地域タグ + 自由記帳
 *
 * 「自分が何をしたか」を最小限の手間で記録し、因果ログに組み込む。
 * ゲームドメインでは「プロダクト(企画)」「マーケ(広告運用)」の2レーンを切り替えて
 * 施策を記録し、マーケ施策には媒体・地域タグを付与できる。
 */
export default memo(function EventQuickInput({ onAddNote }) {
  const { domainId } = useDomain()
  const { target } = useTarget()

  const allPresets = QUICK_EVENT_PRESETS[domainId] || QUICK_EVENT_PRESETS._default
  const availableLanes = useMemo(() => {
    const set = new Set()
    for (const p of allPresets) set.add(p.lane || 'product')
    return [...set]
  }, [allPresets])
  const showLaneTabs = availableLanes.length > 1

  const today = new Date().toISOString().slice(0, 10)
  const [lane, setLane] = useState(availableLanes[0] || 'product')
  const [selected, setSelected] = useState(null)
  const [date, setDate] = useState(today)
  const [memo, setMemo] = useState('')
  const [impact, setImpact] = useState(null) // null = use preset default
  const [media, setMedia] = useState([]) // 媒体タグ (マーケ施策で使用)
  const [region, setRegion] = useState(null) // 地域タグ
  const [freeText, setFreeText] = useState('')
  const [showFreeForm, setShowFreeForm] = useState(false)
  const [saved, setSaved] = useState(false)

  const presets = useMemo(
    () => allPresets.filter(p => (p.lane || 'product') === lane),
    [allPresets, lane]
  )

  const reset = useCallback(() => {
    setSelected(null)
    setDate(new Date().toISOString().slice(0, 10))
    setMemo('')
    setImpact(null)
    setMedia([])
    setRegion(null)
    setFreeText('')
    setShowFreeForm(false)
  }, [])

  const toggleMedia = useCallback((key) => {
    setMedia(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }, [])

  const buildNote = useCallback((preset, { isFree = false, freeEvent = '' } = {}) => {
    const finalImpact = impact || preset?.impact || 'neutral'
    const laneValue = preset?.lane || lane || 'product'
    const event = isFree ? freeEvent : (memo ? `${preset.label}: ${memo}` : preset.label)
    return {
      id: `quick_${Date.now()}`,
      date,
      event,
      app: target?.appName || '',
      layer: preset?.layer || (isFree ? 'ユーザー' : 'ユーザー'),
      impact: finalImpact,
      memo: memo || '',
      quickInput: true,
      eventType: isFree ? 'free' : preset.key,
      lane: laneValue,
      media: laneValue === 'marketing' && media.length ? [...media] : [],
      region: region || null,
    }
  }, [date, memo, impact, target, lane, media, region])

  const handleSave = useCallback((preset) => {
    const p = preset || presets.find(p => p.key === selected)
    if (!p) return
    onAddNote(buildNote(p))
    reset()
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }, [selected, presets, onAddNote, reset, buildNote])

  const handleFreeFormSave = useCallback(() => {
    if (!freeText.trim()) return
    onAddNote(buildNote(null, { isFree: true, freeEvent: freeText.trim() }))
    reset()
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }, [freeText, onAddNote, reset, buildNote])

  const handlePresetClick = useCallback((preset) => {
    if (selected === preset.key) {
      // 同じボタンを再タップで即保存 (ただし媒体/地域タグが必須な場合は要再確認 — 現状は任意)
      handleSave(preset)
    } else {
      setSelected(preset.key)
      setImpact(null)
    }
  }, [selected, handleSave])

  const handleLaneChange = useCallback((nextLane) => {
    setLane(nextLane)
    setSelected(null)
    setMedia([])
  }, [])

  const selectedPreset = presets.find(p => p.key === selected)
  const showMediaChips = selectedPreset && (selectedPreset.lane === 'marketing')

  return (
    <div className="quick-event-input">
      <div className="quick-event-header">
        <span className="quick-event-title">施策を記録</span>
        <span className="quick-event-hint">
          {saved ? '保存しました' : selected ? 'もう一度タップで即保存 / 下で詳細入力' : 'タップで選択'}
        </span>
      </div>

      {/* レーン切替タブ (ゲームドメインなど複数レーンがある時のみ表示) */}
      {showLaneTabs && (
        <div className="quick-event-lane-tabs" style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
          {availableLanes.map(l => {
            const color = LANE_COLORS[l] || '#8b949e'
            const active = l === lane
            return (
              <button
                key={l}
                onClick={() => handleLaneChange(l)}
                className="macro-toggle-btn"
                style={{
                  borderColor: active ? color : '#30363d',
                  background: active ? `${color}22` : 'transparent',
                  color: active ? color : '#8b949e',
                  fontWeight: 600,
                  fontSize: 10,
                  padding: '2px 10px',
                }}
              >
                {LANE_LABELS[l] || l}
              </button>
            )
          })}
        </div>
      )}

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
                const isActive = impact ? impact === opt.key : selectedPreset?.impact === opt.key
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

          {/* 媒体チップ (マーケ施策のみ) */}
          {showMediaChips && (
            <div className="quick-event-detail-row" style={{ flexWrap: 'wrap' }}>
              <span style={{ fontSize: 9, color: '#6e7681', lineHeight: '22px' }}>媒体:</span>
              {MEDIA_OPTIONS.map(opt => {
                const active = media.includes(opt.key)
                return (
                  <button
                    key={opt.key}
                    onClick={() => toggleMedia(opt.key)}
                    className="macro-toggle-btn"
                    style={{
                      borderColor: active ? '#f0883e' : '#30363d',
                      background: active ? 'rgba(240,136,62,0.18)' : 'transparent',
                      color: active ? '#f0883e' : '#8b949e',
                      fontSize: 10,
                      padding: '1px 8px',
                    }}
                  >{opt.label}</button>
                )
              })}
            </div>
          )}

          {/* 地域チップ (全レーン共通・任意) */}
          <div className="quick-event-detail-row" style={{ flexWrap: 'wrap' }}>
            <span style={{ fontSize: 9, color: '#6e7681', lineHeight: '22px' }}>地域:</span>
            {REGION_OPTIONS.map(opt => {
              const active = region === opt.key
              return (
                <button
                  key={opt.key}
                  onClick={() => setRegion(active ? null : opt.key)}
                  className="macro-toggle-btn"
                  style={{
                    borderColor: active ? '#388bfd' : '#30363d',
                    background: active ? 'rgba(56,139,253,0.18)' : 'transparent',
                    color: active ? '#388bfd' : '#8b949e',
                    fontSize: 10,
                    padding: '1px 8px',
                  }}
                >{opt.label}</button>
              )
            })}
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

          {/* 自由記帳でも地域タグは付与可能 */}
          <div className="quick-event-detail-row" style={{ flexWrap: 'wrap' }}>
            <span style={{ fontSize: 9, color: '#6e7681', lineHeight: '22px' }}>地域:</span>
            {REGION_OPTIONS.map(opt => {
              const active = region === opt.key
              return (
                <button
                  key={opt.key}
                  onClick={() => setRegion(active ? null : opt.key)}
                  className="macro-toggle-btn"
                  style={{
                    borderColor: active ? '#388bfd' : '#30363d',
                    background: active ? 'rgba(56,139,253,0.18)' : 'transparent',
                    color: active ? '#388bfd' : '#8b949e',
                    fontSize: 10,
                    padding: '1px 8px',
                  }}
                >{opt.label}</button>
              )
            })}
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
