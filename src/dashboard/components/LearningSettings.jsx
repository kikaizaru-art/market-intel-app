import { useState, useMemo, memo } from 'react'
import { PATTERN_TYPE_LABELS, PATTERN_TYPE_COLORS } from '../constants.js'
import {
  getUserSettings, updateUserSettings, applyPreset,
  PRESETS,
  getLearningTimeline, rollbackToIndex,
  lockLearning, unlockLearning, isLearningLocked, getLockedAtIndex,
  exportLearningData, importLearningData,
} from '../services/patternStore.js'

// ─── スライダー ──────────────────────────────────────────────
function Slider({ label, value, min, max, step, format, onChange, disabled }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#8b949e', marginBottom: 2 }}>
        <span>{label}</span>
        <span style={{ color: '#e6edf3', fontWeight: 600 }}>{format ? format(value) : value}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        disabled={disabled}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', height: 4, appearance: 'none', background: '#21262d', borderRadius: 2, outline: 'none', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}
      />
    </div>
  )
}

// ─── トグル ──────────────────────────────────────────────────
function Toggle({ label, color, checked, onChange, disabled }) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: 6, fontSize: 10,
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
      padding: '3px 6px', borderRadius: 4,
      background: checked ? `${color}11` : 'transparent',
      border: `1px solid ${checked ? color + '44' : '#21262d'}`,
    }}>
      <input
        type="checkbox" checked={checked} disabled={disabled}
        onChange={e => onChange(e.target.checked)}
        style={{ display: 'none' }}
      />
      <div style={{
        width: 28, height: 14, borderRadius: 7, position: 'relative',
        background: checked ? color : '#30363d', transition: 'background 0.2s',
      }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%', background: '#fff',
          position: 'absolute', top: 2,
          left: checked ? 16 : 2, transition: 'left 0.2s',
        }} />
      </div>
      <span style={{ color: checked ? color : '#6e7681' }}>{label}</span>
    </label>
  )
}

// ─── タイムラインバー (的中率の推移を可視化) ─────────────────
function AccuracyTimeline({ timeline, lockedAt, onRollback }) {
  if (!timeline.length) return null
  // 最大60件を可視化 (長いログは間引き)
  const step = Math.max(1, Math.floor(timeline.length / 60))
  const sampled = timeline.filter((_, i) => i % step === 0 || i === timeline.length - 1)

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 9, color: '#6e7681', marginBottom: 3 }}>的中率の推移</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 32 }}>
        {sampled.map((entry) => {
          const h = Math.max(2, (entry.cumulativeAccuracy / 100) * 30)
          const isLockPoint = lockedAt !== null && entry.index === lockedAt
          const color = entry.cumulativeAccuracy >= 70 ? '#56d364'
            : entry.cumulativeAccuracy >= 40 ? '#e3b341' : '#f85149'
          return (
            <div
              key={entry.index}
              onClick={() => onRollback(entry.index)}
              title={`#${entry.index + 1}: ${PATTERN_TYPE_LABELS[entry.patternType] || entry.patternType} / ${entry.action === 'confirmed' ? '的中' : '外れ'} / 累計的中率 ${entry.cumulativeAccuracy}%\n${new Date(entry.timestamp).toLocaleString('ja-JP')}\nクリックでここまで巻き戻し`}
              style={{
                flex: 1, minWidth: 3, maxWidth: 8, height: h,
                background: isLockPoint ? '#e3b341' : color,
                borderRadius: '1px 1px 0 0', cursor: 'pointer',
                opacity: lockedAt !== null && entry.index > lockedAt ? 0.25 : 0.8,
                transition: 'opacity 0.2s',
                borderBottom: isLockPoint ? '2px solid #e3b341' : 'none',
              }}
            />
          )
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#484f58', marginTop: 1 }}>
        <span>#{1}</span>
        <span>#{timeline.length}</span>
      </div>
    </div>
  )
}

// ─── メイン ──────────────────────────────────────────────────
export default memo(function LearningSettings({ onSettingsChange }) {
  const [settings, setSettings] = useState(() => getUserSettings())
  const [locked, setLocked] = useState(() => isLearningLocked())
  const [lockedAt, setLockedAt] = useState(() => getLockedAtIndex())
  const [timelineVersion, setTimelineVersion] = useState(0)
  const [activeTab, setActiveTab] = useState('patterns') // patterns | thresholds | timeline | data
  const [importMsg, setImportMsg] = useState(null)

  const timeline = useMemo(() => {
    return getLearningTimeline()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timelineVersion])

  function update(partial) {
    const updated = updateUserSettings(partial)
    setSettings(updated)
    onSettingsChange?.(updated)
  }

  function handleTogglePattern(patternType, enabled) {
    update({ enabledPatterns: { ...settings.enabledPatterns, [patternType]: enabled } })
  }

  function handlePreset(name) {
    const updated = applyPreset(name)
    setSettings(updated)
    onSettingsChange?.(updated)
  }

  function handleRollback(index) {
    if (locked) return
    rollbackToIndex(index)
    setLockedAt(null)
    setLocked(false)
    setTimelineVersion(v => v + 1)
    onSettingsChange?.()
  }

  function handleLock() {
    const idx = lockLearning()
    setLocked(true)
    setLockedAt(idx)
    onSettingsChange?.()
  }

  function handleUnlock() {
    unlockLearning()
    setLocked(false)
    setLockedAt(null)
    setTimelineVersion(v => v + 1)
    onSettingsChange?.()
  }

  const TAB_STYLE = (active) => ({
    fontSize: 10, padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
    border: `1px solid ${active ? '#388bfd44' : '#21262d'}`,
    background: active ? 'rgba(56,139,253,0.15)' : 'transparent',
    color: active ? '#388bfd' : '#6e7681',
  })

  return (
    <div style={{ background: '#0d1117', borderRadius: 8, border: '1px solid #21262d', padding: 10, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#d2a8ff' }}>学習カスタマイズ</span>
        {locked && (
          <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3, background: 'rgba(227,179,65,0.15)', color: '#e3b341', border: '1px solid rgba(227,179,65,0.3)' }}>
            固定中 (#{lockedAt !== null ? lockedAt + 1 : '?'})
          </span>
        )}
      </div>

      {/* タブ */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        <button onClick={() => setActiveTab('patterns')} style={TAB_STYLE(activeTab === 'patterns')}>検出パターン</button>
        <button onClick={() => setActiveTab('thresholds')} style={TAB_STYLE(activeTab === 'thresholds')}>閾値・学習速度</button>
        <button onClick={() => setActiveTab('timeline')} style={TAB_STYLE(activeTab === 'timeline')}>
          学習履歴 {timeline.length > 0 && `(${timeline.length})`}
        </button>
        <button onClick={() => setActiveTab('data')} style={TAB_STYLE(activeTab === 'data')}>データ管理</button>
      </div>

      {/* ─── 検出パターン タブ ─── */}
      {activeTab === 'patterns' && (
        <div>
          <div style={{ fontSize: 9, color: '#6e7681', marginBottom: 6 }}>
            各パターンの検出を個別にON/OFFできます
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {Object.entries(PATTERN_TYPE_LABELS).map(([key, label]) => (
              <Toggle
                key={key}
                label={label}
                color={PATTERN_TYPE_COLORS[key]}
                checked={settings.enabledPatterns[key] !== false}
                onChange={v => handleTogglePattern(key, v)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ─── 閾値・学習速度 タブ ─── */}
      {activeTab === 'thresholds' && (
        <div>
          {/* プリセット */}
          <div style={{ fontSize: 9, color: '#6e7681', marginBottom: 4 }}>プリセット</div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            {Object.entries(PRESETS).map(([name, preset]) => {
              const isActive = settings.preset === name
              return (
                <button
                  key={name}
                  onClick={() => handlePreset(name)}
                  title={preset.description}
                  style={{
                    fontSize: 10, padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
                    border: `1px solid ${isActive ? '#d2a8ff66' : '#21262d'}`,
                    background: isActive ? 'rgba(210,168,255,0.15)' : 'transparent',
                    color: isActive ? '#d2a8ff' : '#6e7681',
                  }}
                >
                  {preset.label}
                  {isActive && settings.preset !== 'custom' && ' *'}
                </button>
              )
            })}
            {settings.preset === 'custom' && (
              <span style={{ fontSize: 9, color: '#e3b341', alignSelf: 'center' }}>カスタム</span>
            )}
          </div>

          {/* 検出閾値 */}
          <div style={{ fontSize: 9, color: '#6e7681', marginBottom: 4 }}>検出感度</div>
          <Slider
            label="トレンド変動検出"
            value={settings.thresholds.trendShiftPct}
            min={3} max={30} step={1}
            format={v => `${v >= 0 ? '+' : ''}${v}%`}
            onChange={v => update({ thresholds: { ...settings.thresholds, trendShiftPct: v } })}
          />
          <Slider
            label="レビュー急変検出"
            value={settings.thresholds.reviewSpikeDelta}
            min={0.1} max={1.0} step={0.05}
            format={v => `${v >= 0 ? '+' : ''}${v.toFixed(2)}`}
            onChange={v => update({ thresholds: { ...settings.thresholds, reviewSpikeDelta: v } })}
          />

          {/* 自動判定閾値 */}
          <div style={{ fontSize: 9, color: '#6e7681', marginBottom: 4, marginTop: 6 }}>自動判定ライン</div>
          <Slider
            label="自動承認ライン"
            value={settings.thresholds.autoConfirm}
            min={0.40} max={0.95} step={0.05}
            format={v => `${(v * 100).toFixed(0)}%`}
            onChange={v => {
              const clamped = Math.max(v, settings.thresholds.autoReject + 0.1)
              update({ thresholds: { ...settings.thresholds, autoConfirm: clamped } })
            }}
          />
          <Slider
            label="自動却下ライン"
            value={settings.thresholds.autoReject}
            min={0.10} max={0.60} step={0.05}
            format={v => `${(v * 100).toFixed(0)}%`}
            onChange={v => {
              const clamped = Math.min(v, settings.thresholds.autoConfirm - 0.1)
              update({ thresholds: { ...settings.thresholds, autoReject: clamped } })
            }}
          />

          {/* 学習速度 */}
          <div style={{ fontSize: 9, color: '#6e7681', marginBottom: 4, marginTop: 6 }}>学習速度</div>
          <Slider
            label="的中時の加算"
            value={settings.learningRate.confirm}
            min={0.01} max={0.10} step={0.01}
            format={v => `+${(v * 100).toFixed(0)}%`}
            onChange={v => update({ learningRate: { ...settings.learningRate, confirm: v } })}
          />
          <Slider
            label="外れ時の減算"
            value={Math.abs(settings.learningRate.reject)}
            min={0.01} max={0.10} step={0.01}
            format={v => `-${(v * 100).toFixed(0)}%`}
            onChange={v => update({ learningRate: { ...settings.learningRate, reject: -v } })}
          />
        </div>
      )}

      {/* ─── データ管理 タブ ─── */}
      {activeTab === 'data' && (
        <div>
          <div style={{ fontSize: 9, color: '#6e7681', marginBottom: 8, lineHeight: 1.5 }}>
            学習データをファイルにエクスポート/インポートして永続化できます。ブラウザのlocalStorageが消えてもデータを復元可能です。
          </div>

          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <button
              onClick={() => {
                const data = exportLearningData()
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `market-intel-learning-${new Date().toISOString().slice(0, 10)}.json`
                a.click()
                URL.revokeObjectURL(url)
              }}
              style={{
                flex: 1, fontSize: 10, padding: '8px 12px', borderRadius: 6, cursor: 'pointer',
                border: '1px solid rgba(56,139,253,0.3)', background: 'rgba(56,139,253,0.08)', color: '#388bfd',
              }}
            >
              エクスポート (JSON)
            </button>
            <label style={{
              flex: 1, fontSize: 10, padding: '8px 12px', borderRadius: 6, cursor: 'pointer',
              border: '1px solid rgba(210,168,255,0.3)', background: 'rgba(210,168,255,0.08)', color: '#d2a8ff',
              textAlign: 'center',
            }}>
              インポート
              <input
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = (ev) => {
                    try {
                      const data = JSON.parse(ev.target.result)
                      const result = importLearningData(data)
                      setImportMsg(result)
                      if (result.success) {
                        setSettings(getUserSettings())
                        setTimelineVersion(v => v + 1)
                        onSettingsChange?.()
                      }
                    } catch {
                      setImportMsg({ success: false, message: 'JSONの解析に失敗しました' })
                    }
                  }
                  reader.readAsText(file)
                  e.target.value = ''
                }}
              />
            </label>
          </div>

          {importMsg && (
            <div style={{
              fontSize: 10, padding: '6px 10px', borderRadius: 4, marginBottom: 8,
              background: importMsg.success ? 'rgba(86,211,100,0.08)' : 'rgba(248,81,73,0.08)',
              color: importMsg.success ? '#56d364' : '#f85149',
              border: `1px solid ${importMsg.success ? 'rgba(86,211,100,0.3)' : 'rgba(248,81,73,0.3)'}`,
            }}>
              {importMsg.message}
            </div>
          )}

          <div style={{ fontSize: 9, color: '#484f58', lineHeight: 1.5 }}>
            エクスポートファイルには学習重み・フィードバックログ・設定が含まれます。
            インポートすると現在のデータは上書きされます。
          </div>
        </div>
      )}

      {/* ─── 学習履歴 タブ ─── */}
      {activeTab === 'timeline' && (
        <div>
          <div style={{ fontSize: 9, color: '#6e7681', marginBottom: 6, lineHeight: 1.5 }}>
            学習履歴のバーをクリックすると、その時点まで巻き戻せます。「固定」で学習の進行を一時停止できます。
          </div>

          {/* 固定/解除ボタン */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
            {locked ? (
              <button onClick={handleUnlock} style={{
                fontSize: 10, padding: '4px 12px', borderRadius: 4, cursor: 'pointer',
                border: '1px solid rgba(227,179,65,0.4)', background: 'rgba(227,179,65,0.12)', color: '#e3b341',
              }}>
                固定解除 — 学習を再開
              </button>
            ) : (
              <button onClick={handleLock} disabled={!timeline.length} style={{
                fontSize: 10, padding: '4px 12px', borderRadius: 4, cursor: timeline.length ? 'pointer' : 'not-allowed',
                border: '1px solid rgba(227,179,65,0.3)', background: 'rgba(227,179,65,0.06)', color: '#e3b341',
                opacity: timeline.length ? 1 : 0.4,
              }}>
                現在の状態で固定
              </button>
            )}
            {locked && (
              <span style={{ fontSize: 9, color: '#484f58' }}>
                重みの更新が停止中。解除すると蓄積分を反映して再計算します。
              </span>
            )}
          </div>

          {/* 的中率推移バー */}
          <AccuracyTimeline
            timeline={timeline}
            lockedAt={lockedAt}
            onRollback={handleRollback}
          />

          {/* 直近の学習イベント一覧 */}
          {timeline.length === 0 ? (
            <div style={{ fontSize: 10, color: '#484f58', textAlign: 'center', padding: 12 }}>
              学習履歴はまだありません
            </div>
          ) : (
            <div style={{ maxHeight: 140, overflowY: 'auto' }}>
              {[...timeline].reverse().slice(0, 50).map((entry) => {
                const isConfirmed = entry.action === 'confirmed'
                const isAfterLock = locked && lockedAt !== null && entry.index > lockedAt
                return (
                  <div key={`${entry.id}-${entry.index}`} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '3px 6px', borderRadius: 3, marginBottom: 2,
                    background: isAfterLock ? 'rgba(227,179,65,0.04)' : '#161b22',
                    border: `1px solid ${isAfterLock ? '#e3b34122' : '#21262d'}`,
                    opacity: isAfterLock ? 0.5 : 1,
                  }}>
                    <span style={{ fontSize: 9, color: '#484f58', minWidth: 22, textAlign: 'right' }}>
                      #{entry.index + 1}
                    </span>
                    <span style={{
                      fontSize: 8, padding: '1px 4px', borderRadius: 2, fontWeight: 600,
                      background: isConfirmed ? 'rgba(86,211,100,0.12)' : 'rgba(248,81,73,0.12)',
                      color: isConfirmed ? '#56d364' : '#f85149',
                    }}>
                      {isConfirmed ? '的中' : '外れ'}
                    </span>
                    <span style={{
                      fontSize: 8, padding: '1px 4px', borderRadius: 2,
                      background: `${PATTERN_TYPE_COLORS[entry.patternType] || '#6e7681'}18`,
                      color: PATTERN_TYPE_COLORS[entry.patternType] || '#6e7681',
                    }}>
                      {PATTERN_TYPE_LABELS[entry.patternType] || entry.patternType}
                    </span>
                    <span style={{ fontSize: 8, color: '#6e7681', marginLeft: 'auto' }}>
                      {entry.source === 'manual' ? '手動' : '自動'}
                    </span>
                    <span style={{ fontSize: 8, color: '#484f58' }}>
                      的中率{entry.cumulativeAccuracy}%
                    </span>
                    {!locked && (
                      <button
                        onClick={() => handleRollback(entry.index)}
                        title={`#${entry.index + 1} まで巻き戻す`}
                        style={{
                          fontSize: 8, padding: '1px 4px', borderRadius: 2, cursor: 'pointer',
                          border: '1px solid #388bfd33', background: 'transparent', color: '#388bfd',
                        }}
                      >
                        ここまで
                      </button>
                    )}
                  </div>
                )
              })}
              {timeline.length > 50 && (
                <div style={{ fontSize: 9, color: '#484f58', textAlign: 'center', padding: 4 }}>
                  ...他 {timeline.length - 50}件
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
})
