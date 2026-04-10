import { useState, useMemo, memo } from 'react'
import { PATTERN_TYPE_LABELS, PATTERN_TYPE_COLORS } from '../constants.js'
import {
  getUserSettings, updateUserSettings, applyPreset,
  PRESETS,
  getSnapshots, saveSnapshot, restoreSnapshot, deleteSnapshot,
  lockSnapshot, unlockSnapshot, getLockedSnapshotName,
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

// ─── メイン ──────────────────────────────────────────────────
export default memo(function LearningSettings({ onSettingsChange }) {
  const [settings, setSettings] = useState(() => getUserSettings())
  const [snapshotData, setSnapshotData] = useState(() => getSnapshots())
  const [newSnapshotName, setNewSnapshotName] = useState('')
  const [activeTab, setActiveTab] = useState('patterns') // patterns | thresholds | snapshots

  const lockedName = snapshotData.lockedSnapshot

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

  function handleSaveSnapshot() {
    const name = newSnapshotName.trim()
    if (!name) return
    const data = saveSnapshot(name)
    setSnapshotData(data)
    setNewSnapshotName('')
  }

  function handleRestoreSnapshot(name) {
    restoreSnapshot(name)
    onSettingsChange?.(settings)
  }

  function handleDeleteSnapshot(name) {
    const data = deleteSnapshot(name)
    setSnapshotData(data)
  }

  function handleLock(name) {
    const data = lockSnapshot(name)
    setSnapshotData(data)
    onSettingsChange?.(settings)
  }

  function handleUnlock() {
    const data = unlockSnapshot()
    setSnapshotData(data)
    onSettingsChange?.(settings)
  }

  const snapshots = snapshotData.snapshots

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
        {lockedName && (
          <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3, background: 'rgba(227,179,65,0.15)', color: '#e3b341', border: '1px solid rgba(227,179,65,0.3)' }}>
            固定中: {lockedName}
          </span>
        )}
      </div>

      {/* タブ */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        <button onClick={() => setActiveTab('patterns')} style={TAB_STYLE(activeTab === 'patterns')}>検出パターン</button>
        <button onClick={() => setActiveTab('thresholds')} style={TAB_STYLE(activeTab === 'thresholds')}>閾値・学習速度</button>
        <button onClick={() => setActiveTab('snapshots')} style={TAB_STYLE(activeTab === 'snapshots')}>
          スナップショット {snapshots.length > 0 && `(${snapshots.length})`}
        </button>
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
                disabled={!!lockedName}
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
                  disabled={!!lockedName}
                  title={preset.description}
                  style={{
                    fontSize: 10, padding: '4px 10px', borderRadius: 4, cursor: lockedName ? 'not-allowed' : 'pointer',
                    border: `1px solid ${isActive ? '#d2a8ff66' : '#21262d'}`,
                    background: isActive ? 'rgba(210,168,255,0.15)' : 'transparent',
                    color: isActive ? '#d2a8ff' : '#6e7681',
                    opacity: lockedName ? 0.5 : 1,
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
            disabled={!!lockedName}
          />
          <Slider
            label="レビュー急変検出"
            value={settings.thresholds.reviewSpikeDelta}
            min={0.1} max={1.0} step={0.05}
            format={v => `${v >= 0 ? '+' : ''}${v.toFixed(2)}`}
            onChange={v => update({ thresholds: { ...settings.thresholds, reviewSpikeDelta: v } })}
            disabled={!!lockedName}
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
            disabled={!!lockedName}
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
            disabled={!!lockedName}
          />

          {/* 学習速度 */}
          <div style={{ fontSize: 9, color: '#6e7681', marginBottom: 4, marginTop: 6 }}>学習速度</div>
          <Slider
            label="的中時の加算"
            value={settings.learningRate.confirm}
            min={0.01} max={0.10} step={0.01}
            format={v => `+${(v * 100).toFixed(0)}%`}
            onChange={v => update({ learningRate: { ...settings.learningRate, confirm: v } })}
            disabled={!!lockedName}
          />
          <Slider
            label="外れ時の減算"
            value={Math.abs(settings.learningRate.reject)}
            min={0.01} max={0.10} step={0.01}
            format={v => `-${(v * 100).toFixed(0)}%`}
            onChange={v => update({ learningRate: { ...settings.learningRate, reject: -v } })}
            disabled={!!lockedName}
          />
        </div>
      )}

      {/* ─── スナップショット タブ ─── */}
      {activeTab === 'snapshots' && (
        <div>
          <div style={{ fontSize: 9, color: '#6e7681', marginBottom: 6, lineHeight: 1.5 }}>
            現在の学習状態を保存・復元できます。「固定」すると学習の進行を一時停止します。
          </div>

          {/* 新規保存 */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            <input
              type="text"
              placeholder="スナップショット名..."
              value={newSnapshotName}
              onChange={e => setNewSnapshotName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveSnapshot()}
              style={{
                flex: 1, fontSize: 10, padding: '4px 8px', borderRadius: 4,
                border: '1px solid #21262d', background: '#161b22', color: '#e6edf3',
                outline: 'none',
              }}
            />
            <button
              onClick={handleSaveSnapshot}
              disabled={!newSnapshotName.trim()}
              style={{
                fontSize: 10, padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
                border: '1px solid rgba(86,211,100,0.3)', background: 'rgba(86,211,100,0.1)',
                color: '#56d364', opacity: newSnapshotName.trim() ? 1 : 0.4,
              }}
            >
              保存
            </button>
          </div>

          {/* 一覧 */}
          {snapshots.length === 0 ? (
            <div style={{ fontSize: 10, color: '#484f58', textAlign: 'center', padding: 12 }}>
              保存されたスナップショットはありません
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[...snapshots].reverse().map(snap => {
                const isLocked = lockedName === snap.name
                const accuracy = snap.stats.total > 0 ? Math.round((snap.stats.confirmed / snap.stats.total) * 100) : null
                return (
                  <div key={snap.name} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px',
                    borderRadius: 4, border: `1px solid ${isLocked ? '#e3b34144' : '#21262d'}`,
                    background: isLocked ? 'rgba(227,179,65,0.06)' : '#161b22',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 10, color: '#e6edf3', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {isLocked && <span style={{ color: '#e3b341', marginRight: 4 }}>&#x1F512;</span>}
                        {snap.name}
                      </div>
                      <div style={{ fontSize: 9, color: '#484f58' }}>
                        {new Date(snap.timestamp).toLocaleDateString('ja-JP')}
                        {' / '}検証{snap.stats.total}件
                        {accuracy !== null && ` / 的中${accuracy}%`}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 3 }}>
                      {isLocked ? (
                        <button onClick={handleUnlock} style={snapBtnStyle('#e3b341')} title="固定解除">
                          解除
                        </button>
                      ) : (
                        <>
                          <button onClick={() => handleLock(snap.name)} style={snapBtnStyle('#e3b341')} title="学習を固定">
                            固定
                          </button>
                          <button onClick={() => handleRestoreSnapshot(snap.name)} style={snapBtnStyle('#388bfd')} title="この状態に復元">
                            復元
                          </button>
                          <button onClick={() => handleDeleteSnapshot(snap.name)} style={snapBtnStyle('#f85149')} title="削除">
                            削除
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
})

const snapBtnStyle = (color) => ({
  fontSize: 9, padding: '2px 6px', borderRadius: 3, cursor: 'pointer',
  border: `1px solid ${color}44`, background: `${color}11`, color,
})
