/**
 * ローカルLLMサービス (Ollama ベース)
 *
 * - Ollama (localhost:11434) に接続し、因果パターンの要約・分析を生成
 * - 未接続時はテンプレートベースのフォールバックで動作
 * - 設定は storageBackend 経由で IndexedDB に永続化
 */

import { getItem, setItem } from './storageBackend.js'

// ─── 定数 ──────────────────────────────────────────────────────
const STORAGE_KEY = 'market-intel-llm-settings'

const DEFAULT_SETTINGS = {
  endpoint: 'http://localhost:11434',
  model: '',           // 空 = 初回接続時に自動選択
  enabled: true,
  maxTokens: 1024,
  temperature: 0.3,    // 分析タスクなので低め
}

// ─── 状態管理 ──────────────────────────────────────────────────
let settings = null
let connectionStatus = 'unknown' // 'unknown' | 'connected' | 'disconnected' | 'checking'
let availableModels = []
let statusListeners = []

// ─── 設定の読み書き ────────────────────────────────────────────

function loadSettings() {
  if (settings) return settings
  try {
    const raw = getItem(STORAGE_KEY)
    settings = raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS }
  } catch {
    settings = { ...DEFAULT_SETTINGS }
  }
  return settings
}

function saveSettings(newSettings) {
  settings = { ...settings, ...newSettings }
  setItem(STORAGE_KEY, JSON.stringify(settings))
  notifyListeners()
}

export function getSettings() {
  return { ...loadSettings() }
}

export function updateSettings(partial) {
  saveSettings(partial)
}

// ─── ステータス管理 ────────────────────────────────────────────

export function getConnectionStatus() {
  return connectionStatus
}

export function getAvailableModels() {
  return [...availableModels]
}

export function onStatusChange(listener) {
  statusListeners.push(listener)
  return () => {
    statusListeners = statusListeners.filter(l => l !== listener)
  }
}

function notifyListeners() {
  const state = {
    status: connectionStatus,
    models: availableModels,
    settings: getSettings(),
  }
  for (const listener of statusListeners) {
    try { listener(state) } catch {}
  }
}

function setStatus(status) {
  connectionStatus = status
  notifyListeners()
}

// ─── Ollama API ────────────────────────────────────────────────

/**
 * Ollama の接続確認 + モデル一覧を取得
 */
export async function checkConnection() {
  const s = loadSettings()
  if (!s.enabled) {
    setStatus('disconnected')
    return false
  }

  setStatus('checking')
  try {
    const res = await fetch(`${s.endpoint}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    availableModels = (data.models || []).map(m => ({
      name: m.name,
      size: m.size,
      modified: m.modified_at,
    }))

    // モデル未設定なら最初のモデルを自動選択
    if (!s.model && availableModels.length > 0) {
      saveSettings({ model: availableModels[0].name })
    }

    setStatus('connected')
    return true
  } catch {
    availableModels = []
    setStatus('disconnected')
    return false
  }
}

/**
 * Ollama でチャット補完を実行
 *
 * @param {string} prompt - システムプロンプト
 * @param {string} userMessage - ユーザーメッセージ
 * @param {object} [options] - オプション
 * @returns {Promise<string|null>} 生成テキスト、失敗時は null
 */
export async function chat(prompt, userMessage, options = {}) {
  const s = loadSettings()
  if (!s.enabled || connectionStatus !== 'connected') return null

  const model = options.model || s.model
  if (!model) return null

  try {
    const res = await fetch(`${s.endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: userMessage },
        ],
        stream: false,
        options: {
          num_predict: options.maxTokens || s.maxTokens,
          temperature: options.temperature ?? s.temperature,
        },
      }),
      signal: AbortSignal.timeout(60000),
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return data.message?.content || null
  } catch (e) {
    console.warn('[llm] chat failed:', e.message)
    // 接続エラーなら status を更新
    if (e.name === 'TypeError' || e.name === 'AbortError') {
      setStatus('disconnected')
    }
    return null
  }
}

// ─── 判定ヘルパー ──────────────────────────────────────────────

/**
 * LLM が利用可能かどうか
 */
export function isAvailable() {
  return loadSettings().enabled && connectionStatus === 'connected'
}
