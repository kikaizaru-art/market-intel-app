import { useState, useEffect, useCallback } from 'react'
import { useDomain } from '../context/DomainContext.jsx'
import { useTarget } from '../context/TargetContext.jsx'
import { getConnectionStatus, getSettings as getLlmSettings, getAvailableModels, onStatusChange } from '../services/llmService.js'
import { loadCausalNotes, saveCausalNotes } from '../services/patternStore.js'
import { QUICK_EVENT_PRESETS } from '../constants.js'

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

// ─── クイック入力モックデータ ──────────────────────────────────
function generateQuickEventMocks(domainId, targetName) {
  const presets = QUICK_EVENT_PRESETS[domainId] || QUICK_EVENT_PRESETS._default
  const now = new Date()
  const app = targetName || ''

  // 過去30日にわたるサンプルイベントを生成
  const SAMPLE_MEMOS = {
    'game-market': {
      update:   ['v3.2.0 バランス調整', 'v3.1.5 緊急バグ修正', 'v3.3.0 新キャラ追加'],
      gacha:    ['1.5周年記念ガチャ', '限定キャラ復刻', 'コラボ限定ガチャ'],
      collab:   ['人気アニメコラボ開始', 'VTuberコラボイベント', ''],
      campaign: ['ログインボーナス強化', 'Twitterフォロワー感謝CP', ''],
      bug:      ['課金画面クラッシュ', 'マルチプレイ不安定', ''],
      ad_change:['TikTok広告開始', 'TVCMシリーズ第2弾', ''],
    },
    'influencer': {
      video:    ['検証系動画(100万再生)', 'ショート動画バズ', 'コラボ動画投稿'],
      live:     ['ゲーム実況配信 5時間', '雑談配信', ''],
      sponsor:  ['飲料メーカー案件', 'ゲームアプリ案件', ''],
      collab:   ['人気YouTuberコラボ', '海外クリエイターコラボ', ''],
      ch_change:['サムネイルデザイン変更', 'アイコン/バナー刷新', ''],
      trend:    ['バズワード乗り', '急上昇ランキング入り', ''],
    },
    'stock': {
      earnings: ['Q3決算: 営業利益+15%', 'Q2決算: 売上横ばい', ''],
      guidance: ['通期上方修正', '下方修正(原材料高)', ''],
      buyback:  ['100億円自社株買い発表', '', ''],
      dividend: ['増配(年80円→100円)', '', ''],
      ma:       ['米国企業買収発表', '業務提携リリース', ''],
      regulation:['新規制案パブコメ', '', ''],
    },
    'keiba': {
      race:     ['G1 1着(2:00.5)', 'G2 3着(ハナ差)', '重賞初勝利'],
      training: ['坂路52秒台(好時計)', 'CW追い切り馬なり', ''],
      jockey:   ['主戦→リーディング騎手変更', '', ''],
      track:    ['稍重→良馬場回復', '不良馬場', ''],
      draw:     ['大外枠(8枠16番)', '内枠1番', ''],
      odds:     ['前日1番人気→当日3番人気', '', ''],
    },
  }

  const memos = SAMPLE_MEMOS[domainId] || {}
  const notes = []

  presets.forEach((preset, i) => {
    const presetMemos = memos[preset.key] || ['', '', '']
    // 各プリセットから1〜2個のモックを生成
    const count = i < 3 ? 2 : 1
    for (let j = 0; j < count; j++) {
      const daysAgo = Math.floor(Math.random() * 28) + 1
      const d = new Date(now)
      d.setDate(d.getDate() - daysAgo)
      const dateStr = d.toISOString().slice(0, 10)
      const memo = presetMemos[j] || ''

      notes.push({
        id: `mock_quick_${Date.now()}_${i}_${j}`,
        date: dateStr,
        event: memo ? `${preset.label}: ${memo}` : preset.label,
        app,
        layer: preset.layer,
        impact: preset.impact,
        memo,
        quickInput: true,
        eventType: preset.key,
      })
    }
  })

  return notes.sort((a, b) => b.date.localeCompare(a.date))
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

  // ─── Quick Event debug helpers ──────────────────────
  const [quickEventMsg, setQuickEventMsg] = useState('')

  const getQuickEventStats = useCallback(() => {
    const notes = loadCausalNotes() || []
    const quickNotes = notes.filter(n => n.quickInput)
    return { total: notes.length, quick: quickNotes.length }
  }, [])

  const [qeStats, setQeStats] = useState(() => getQuickEventStats())

  const refreshQeStats = useCallback(() => {
    setQeStats(getQuickEventStats())
  }, [getQuickEventStats])

  useEffect(() => {
    if (open) refreshQeStats()
  }, [open, refreshQeStats])

  const handleInjectMocks = useCallback(() => {
    const mocks = generateQuickEventMocks(domainId, target?.appName)
    const existing = loadCausalNotes() || []
    saveCausalNotes([...mocks, ...existing])
    setQuickEventMsg(`${mocks.length}件 注入 → リロードで反映`)
    refreshQeStats()
    refreshSnapshot()
  }, [domainId, target, refreshQeStats, refreshSnapshot])

  const handleClearQuickMocks = useCallback(() => {
    const existing = loadCausalNotes() || []
    const filtered = existing.filter(n => !n.quickInput)
    saveCausalNotes(filtered)
    setQuickEventMsg(`施策記録を全削除 (${existing.length - filtered.length}件)`)
    refreshQeStats()
    refreshSnapshot()
  }, [refreshQeStats, refreshSnapshot])

  const handleInjectAndReload = useCallback(() => {
    const mocks = generateQuickEventMocks(domainId, target?.appName)
    const existing = loadCausalNotes() || []
    saveCausalNotes([...mocks, ...existing])
    window.location.reload()
  }, [domainId, target])

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

          {/* Quick Event Debug */}
          <div className="debug-section">
            <div className="debug-section-title">Quick Event Input</div>
            <div className="debug-state-grid" style={{ marginBottom: 8 }}>
              <span className="debug-state-key">notes</span>
              <span className="debug-state-val">{qeStats.total}件</span>
              <span className="debug-state-key">施策記録</span>
              <span className="debug-state-val">
                {qeStats.quick > 0
                  ? <span style={{ color: '#d2a8ff' }}>{qeStats.quick}件</span>
                  : <span className="debug-null">0件</span>
                }
              </span>
              <span className="debug-state-key">domain</span>
              <span className="debug-state-val">{domainId}</span>
            </div>
            <div className="debug-actions" style={{ marginBottom: quickEventMsg ? 6 : 0 }}>
              <button className="debug-action-btn" onClick={handleInjectMocks}
                style={{ borderColor: 'rgba(210,168,255,0.3)', color: '#d2a8ff' }}>
                Mock 注入
              </button>
              <button className="debug-action-btn" onClick={handleInjectAndReload}
                style={{ borderColor: 'rgba(210,168,255,0.3)', color: '#d2a8ff' }}>
                注入 + Reload
              </button>
              <button className="debug-action-btn danger" onClick={handleClearQuickMocks}>
                施策記録 Clear
              </button>
            </div>
            {quickEventMsg && (
              <div style={{ fontSize: 9, color: '#56d364', marginTop: 4 }}>
                {quickEventMsg}
              </div>
            )}
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
