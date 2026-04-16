import { useState, useEffect, useCallback } from 'react'
import { useDomain } from '../context/DomainContext.jsx'
import { useTarget } from '../context/TargetContext.jsx'
import { getConnectionStatus, getSettings as getLlmSettings, getAvailableModels, onStatusChange } from '../services/llmService.js'

const STORAGE_KEYS = [
  { key: 'market-intel:domain', label: 'Domain' },
  { key: 'market-intel:target', label: 'Target' },
  { key: 'market-intel:data-mode', label: 'DataMode' },
  { key: 'market-intel-pattern-store', label: 'Patterns' },
  { key: 'market-intel-learning-settings', label: 'Learning' },
  { key: 'market-intel-causal-notes', label: 'CausalNotes' },
  { key: 'market-intel-rejected-auto', label: 'Rejected' },
  { key: 'market-intel-llm-settings', label: 'LLM' },
]

function formatValue(raw) {
  if (raw === null) return null
  try {
    const parsed = JSON.parse(raw)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return raw
  }
}

function StorageRow({ keyDef, snapshot, onClear }) {
  const [expanded, setExpanded] = useState(false)
  const raw = snapshot[keyDef.key]
  const display = formatValue(raw)
  const isJson = display !== raw
  const isEmpty = raw === null

  return (
    <div className="debug-storage-row">
      <div className="debug-storage-header">
        <button
          className="debug-storage-expand"
          onClick={() => !isEmpty && setExpanded(!expanded)}
          disabled={isEmpty}
        >
          {isEmpty ? ' ' : expanded ? '\u25BC' : '\u25B6'}
        </button>
        <span className="debug-storage-label">{keyDef.label}</span>
        <span className={`debug-storage-badge ${isEmpty ? 'empty' : 'set'}`}>
          {isEmpty ? 'empty' : isJson ? 'JSON' : raw}
        </span>
        {!isEmpty && (
          <button className="debug-btn-clear" onClick={() => onClear(keyDef.key)} title="Clear">
            &times;
          </button>
        )}
      </div>
      {expanded && display && (
        <pre className="debug-storage-value">{display}</pre>
      )}
    </div>
  )
}

const LLM_STATUS_COLORS = {
  connected: '#56d364', disconnected: '#f85149', checking: '#e3b341', unknown: '#6e7681',
}

export default function DebugPanel() {
  const [open, setOpen] = useState(false)
  const { domainId, domainList } = useDomain()
  const { target, dataMode, hasCollected, dataSources, reset, setTarget } = useTarget()
  const [storageSnapshot, setStorageSnapshot] = useState({})
  const [llmStatus, setLlmStatus] = useState(getConnectionStatus)
  const [llmModel, setLlmModel] = useState(() => getLlmSettings().model)

  useEffect(() => {
    return onStatusChange(({ status, settings }) => {
      setLlmStatus(status)
      setLlmModel(settings.model)
    })
  }, [])

  const refreshSnapshot = useCallback(() => {
    const snap = {}
    for (const { key } of STORAGE_KEYS) {
      try {
        snap[key] = window.localStorage.getItem(key)
      } catch {
        snap[key] = null
      }
    }
    setStorageSnapshot(snap)
  }, [])

  // Refresh on open and on context changes
  useEffect(() => {
    if (open) refreshSnapshot()
  }, [open, domainId, target, dataMode, refreshSnapshot])

  const handleClearKey = useCallback((key) => {
    try { window.localStorage.removeItem(key) } catch {}
    refreshSnapshot()
  }, [refreshSnapshot])

  const handleClearAll = useCallback(() => {
    for (const { key } of STORAGE_KEYS) {
      try { window.localStorage.removeItem(key) } catch {}
    }
    refreshSnapshot()
  }, [refreshSnapshot])

  const handleReload = useCallback(() => {
    window.location.reload()
  }, [])

  const handleClearAndReload = useCallback(() => {
    for (const { key } of STORAGE_KEYS) {
      try { window.localStorage.removeItem(key) } catch {}
    }
    window.location.reload()
  }, [])

  const handleClearTarget = useCallback(() => {
    try { window.localStorage.removeItem('market-intel:target') } catch {}
    reset()
    refreshSnapshot()
  }, [reset, refreshSnapshot])

  // Toggle with Ctrl+Shift+D
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault()
        setOpen(v => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const currentDomain = domainList.find(d => d.id === domainId)

  return (
    <>
      <button
        className="debug-fab"
        onClick={() => setOpen(v => !v)}
        title="Debug Panel (Ctrl+Shift+D)"
      >
        {open ? '\u2716' : '\u2699'}
      </button>

      {open && (
        <div className="debug-panel">
          <div className="debug-panel-header">
            <span className="debug-panel-title">Debug</span>
            <span className="debug-panel-shortcut">Ctrl+Shift+D</span>
          </div>

          {/* Live State */}
          <div className="debug-section">
            <div className="debug-section-title">Live State</div>
            <div className="debug-state-grid">
              <span className="debug-state-key">domain</span>
              <span className="debug-state-val">
                {currentDomain?.icon} {domainId}
              </span>

              <span className="debug-state-key">target</span>
              <span className="debug-state-val">
                {target ? target.appName : <span className="debug-null">null</span>}
              </span>

              <span className="debug-state-key">company</span>
              <span className="debug-state-val">
                {target ? target.companyName : <span className="debug-null">null</span>}
              </span>

              <span className="debug-state-key">genre</span>
              <span className="debug-state-val">
                {target ? target.genre : <span className="debug-null">null</span>}
              </span>

              <span className="debug-state-key">dataMode</span>
              <span className="debug-state-val">{dataMode}</span>

              <span className="debug-state-key">collected</span>
              <span className="debug-state-val">
                {hasCollected
                  ? <span style={{ color: '#56d364' }}>yes</span>
                  : <span style={{ color: '#8b949e' }}>no</span>}
              </span>

              {dataSources && (
                <>
                  <span className="debug-state-key">sources</span>
                  <span className="debug-state-val debug-sources">
                    {['trends', 'reviews', 'ranking', 'community', 'news'].map(s => (
                      <span key={s} className={`debug-source-dot ${dataSources[s] ? 'on' : 'off'}`} title={s}>
                        {s[0].toUpperCase()}
                      </span>
                    ))}
                  </span>
                </>
              )}

              <span className="debug-state-key">llm</span>
              <span className="debug-state-val">
                <span style={{ color: LLM_STATUS_COLORS[llmStatus] || '#6e7681' }}>
                  {llmStatus}
                </span>
                {llmModel && llmStatus === 'connected' && (
                  <span style={{ color: '#6e7681', marginLeft: 4, fontSize: 9 }}>
                    ({llmModel})
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* localStorage */}
          <div className="debug-section">
            <div className="debug-section-title">localStorage</div>
            {STORAGE_KEYS.map(k => (
              <StorageRow
                key={k.key}
                keyDef={k}
                snapshot={storageSnapshot}
                onClear={handleClearKey}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="debug-section">
            <div className="debug-section-title">Actions</div>
            <div className="debug-actions">
              <button className="debug-action-btn" onClick={handleClearTarget}>
                Target Reset
              </button>
              <button className="debug-action-btn" onClick={handleClearAll}>
                Storage Clear
              </button>
              <button className="debug-action-btn" onClick={handleReload}>
                Reload
              </button>
              <button className="debug-action-btn danger" onClick={handleClearAndReload}>
                Clear + Reload
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
