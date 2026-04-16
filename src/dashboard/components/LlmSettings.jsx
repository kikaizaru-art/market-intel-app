import { useState, useEffect, useCallback } from 'react'
import {
  getSettings, updateSettings, checkConnection,
  getConnectionStatus, getAvailableModels, onStatusChange,
} from '../services/llmService.js'

const STATUS_DISPLAY = {
  connected:    { label: '接続中',     color: '#56d364', icon: '●' },
  disconnected: { label: '未接続',     color: '#f85149', icon: '○' },
  checking:     { label: '確認中…',   color: '#e3b341', icon: '◌' },
  unknown:      { label: '未確認',     color: '#6e7681', icon: '○' },
}

/**
 * LLM 設定パネル (CausationView 内 or DebugPanel 内で使用)
 */
export default function LlmSettings({ compact = false }) {
  const [settings, setSettings] = useState(getSettings)
  const [status, setStatus] = useState(getConnectionStatus)
  const [models, setModels] = useState(getAvailableModels)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    return onStatusChange(({ status: s, models: m, settings: st }) => {
      setStatus(s)
      setModels(m)
      setSettings(st)
    })
  }, [])

  const handleTestConnection = useCallback(async () => {
    setTesting(true)
    await checkConnection()
    setTesting(false)
  }, [])

  const handleToggleEnabled = useCallback(() => {
    const next = !settings.enabled
    updateSettings({ enabled: next })
    setSettings(s => ({ ...s, enabled: next }))
    if (next) {
      handleTestConnection()
    }
  }, [settings.enabled, handleTestConnection])

  const handleEndpointChange = useCallback((e) => {
    const endpoint = e.target.value
    updateSettings({ endpoint })
    setSettings(s => ({ ...s, endpoint }))
  }, [])

  const handleModelChange = useCallback((e) => {
    const model = e.target.value
    updateSettings({ model })
    setSettings(s => ({ ...s, model }))
  }, [])

  const handleTemperatureChange = useCallback((e) => {
    const temperature = parseFloat(e.target.value)
    updateSettings({ temperature })
    setSettings(s => ({ ...s, temperature }))
  }, [])

  const sd = STATUS_DISPLAY[status] || STATUS_DISPLAY.unknown

  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 10, color: sd.color }}>{sd.icon}</span>
        <span style={{ fontSize: 10, color: '#8b949e' }}>LLM</span>
        <span style={{ fontSize: 10, color: sd.color }}>{sd.label}</span>
        {status === 'connected' && settings.model && (
          <span style={{ fontSize: 9, color: '#6e7681' }}>{settings.model}</span>
        )}
        {status !== 'connected' && settings.enabled && (
          <button
            onClick={handleTestConnection}
            disabled={testing}
            style={{
              fontSize: 9, padding: '1px 6px', borderRadius: 3, cursor: 'pointer',
              border: '1px solid #30363d', background: 'transparent', color: '#8b949e',
            }}
          >
            {testing ? '…' : '接続'}
          </button>
        )}
      </div>
    )
  }

  return (
    <div style={{
      marginBottom: 12, background: '#0d1117', borderRadius: 8,
      border: '1px solid #21262d', padding: 10,
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#d2a8ff' }}>
          LLM 設定 (Ollama)
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: sd.color }}>{sd.icon} {sd.label}</span>
          <button
            onClick={handleTestConnection}
            disabled={testing || !settings.enabled}
            style={{
              fontSize: 9, padding: '2px 8px', borderRadius: 4, cursor: 'pointer',
              border: '1px solid #30363d', background: testing ? '#21262d' : 'transparent',
              color: '#8b949e', opacity: !settings.enabled ? 0.4 : 1,
            }}
          >
            {testing ? '確認中…' : '接続テスト'}
          </button>
        </div>
      </div>

      {/* 有効/無効 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={handleToggleEnabled}
            style={{ accentColor: '#d2a8ff' }}
          />
          <span style={{ fontSize: 10, color: '#e6edf3' }}>LLM 分析を有効にする</span>
        </label>
      </div>

      {settings.enabled && (
        <>
          {/* エンドポイント */}
          <div style={{ marginBottom: 6 }}>
            <label style={{ fontSize: 9, color: '#6e7681', display: 'block', marginBottom: 2 }}>
              Ollama エンドポイント
            </label>
            <input
              type="text"
              value={settings.endpoint}
              onChange={handleEndpointChange}
              placeholder="http://localhost:11434"
              style={{
                width: '100%', fontSize: 10, padding: '4px 6px', borderRadius: 4,
                border: '1px solid #30363d', background: '#161b22', color: '#e6edf3',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* モデル選択 */}
          <div style={{ marginBottom: 6 }}>
            <label style={{ fontSize: 9, color: '#6e7681', display: 'block', marginBottom: 2 }}>
              モデル
            </label>
            {models.length > 0 ? (
              <select
                value={settings.model}
                onChange={handleModelChange}
                style={{
                  width: '100%', fontSize: 10, padding: '4px 6px', borderRadius: 4,
                  border: '1px solid #30363d', background: '#161b22', color: '#e6edf3',
                  outline: 'none',
                }}
              >
                {models.map(m => (
                  <option key={m.name} value={m.name}>
                    {m.name} ({(m.size / 1e9).toFixed(1)}GB)
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={settings.model}
                onChange={handleModelChange}
                placeholder="モデル名 (例: llama3.2, gemma2)"
                style={{
                  width: '100%', fontSize: 10, padding: '4px 6px', borderRadius: 4,
                  border: '1px solid #30363d', background: '#161b22', color: '#e6edf3',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            )}
          </div>

          {/* Temperature */}
          <div style={{ marginBottom: 6 }}>
            <label style={{ fontSize: 9, color: '#6e7681', display: 'flex', justifyContent: 'space-between' }}>
              <span>Temperature</span>
              <span>{settings.temperature.toFixed(1)}</span>
            </label>
            <input
              type="range"
              min="0" max="1" step="0.1"
              value={settings.temperature}
              onChange={handleTemperatureChange}
              style={{ width: '100%', accentColor: '#d2a8ff' }}
            />
          </div>

          {/* ヘルプ */}
          <div style={{ fontSize: 9, color: '#484f58', lineHeight: 1.5, marginTop: 4 }}>
            Ollama をローカルで起動してください。
            <br />
            インストール: <span style={{ color: '#6e7681' }}>https://ollama.com</span>
            <br />
            起動後: <span style={{ color: '#6e7681' }}>ollama pull llama3.2</span> でモデルを取得
          </div>
        </>
      )}
    </div>
  )
}
