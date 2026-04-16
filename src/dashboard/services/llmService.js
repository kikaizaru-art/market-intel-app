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
const MOCK_KEY = 'market-intel-llm-mock'

const DEFAULT_SETTINGS = {
  endpoint: 'http://localhost:11434',
  model: '',           // 空 = 初回接続時に自動選択
  enabled: true,
  maxTokens: 1024,
  temperature: 0.3,    // 分析タスクなので低め
}

const MOCK_MODELS = [
  { name: 'mock-llama3.2:3b', size: 2_000_000_000, modified: new Date().toISOString() },
  { name: 'mock-gemma2:9b',   size: 5_400_000_000, modified: new Date().toISOString() },
]

// ─── 状態管理 ──────────────────────────────────────────────────
let settings = null
let connectionStatus = 'unknown' // 'unknown' | 'connected' | 'disconnected' | 'checking'
let availableModels = []
let statusListeners = []
let mockEnabled = false

// ─── 設定の読み書き ────────────────────────────────────────────

function loadSettings() {
  if (settings) return settings
  try {
    const raw = getItem(STORAGE_KEY)
    settings = raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS }
  } catch {
    settings = { ...DEFAULT_SETTINGS }
  }
  // mock flag も同じタイミングで復元
  try {
    mockEnabled = getItem(MOCK_KEY) === '1'
  } catch {
    mockEnabled = false
  }
  if (mockEnabled) {
    availableModels = [...MOCK_MODELS]
    if (!settings.model) settings.model = MOCK_MODELS[0].name
    connectionStatus = 'connected'
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
  if (mockEnabled) {
    availableModels = [...MOCK_MODELS]
    if (!s.model) saveSettings({ model: MOCK_MODELS[0].name })
    setStatus('connected')
    return true
  }
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
  if (mockEnabled) {
    // モックレスポンスを擬似レイテンシ付きで返す
    await new Promise(r => setTimeout(r, 350))
    return buildMockResponse(prompt, userMessage)
  }
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
  if (mockEnabled) return true
  return loadSettings().enabled && connectionStatus === 'connected'
}

// ─── モックモード（デバッグ用） ────────────────────────────────

export function isMockEnabled() {
  loadSettings() // ensure mock flag is loaded
  return mockEnabled
}

export function setMockEnabled(flag) {
  mockEnabled = !!flag
  try {
    setItem(MOCK_KEY, mockEnabled ? '1' : '0')
  } catch {}
  if (mockEnabled) {
    availableModels = [...MOCK_MODELS]
    const s = loadSettings()
    if (!s.model) saveSettings({ model: MOCK_MODELS[0].name })
    setStatus('connected')
  } else {
    availableModels = []
    setStatus('unknown')
  }
}

function buildMockResponse(systemPrompt, userMessage) {
  const isSeasonal = /季節/.test(systemPrompt) || /季節/.test(userMessage)
  const currentMonth = new Date().getMonth() + 1

  if (isSeasonal) {
    return [
      `- 今月(${currentMonth}月)は過去データでも動きが活発な時期で、例年通りの傾向が出ています`,
      '- 直近4週は上昇系メトリクスが優勢、前4週と比べてモメンタムが継続中',
      '- 過去の同月メモではキャンペーン施策と連動した急増が目立ち、今年も同様の効果が期待できます',
      '- 一方で下降系メトリクスは例年より早めに反転しており、注意が必要です',
      '※ これはデバッグ用モック応答です (mock-llm)',
    ].join('\n')
  }

  return [
    '- 直近の因果メモから、施策直後のポジティブな反応が継続する傾向が見られます',
    '- 高信頼パターンが複数検出されており、類似アクションの再現性は高いと考えられます',
    '- 下降トレンドに該当するジャンルがあるため、そちらには注意が必要です',
    '- レビュー急落が観測された対象については、早期の原因調査を推奨します',
    '※ これはデバッグ用モック応答です (mock-llm)',
  ].join('\n')
}
