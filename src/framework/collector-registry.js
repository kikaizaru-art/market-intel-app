/**
 * コレクターレジストリ
 *
 * ドメイン設定が宣言する「どのコレクターを使うか」に対して、
 * 対応するモジュールを解決・実行するプラグインシステム。
 *
 * 各コレクターは独立して動作し、1つが失敗しても他に影響しない (fail-safe)。
 */

/**
 * @typedef {object} CollectorResult
 * @property {string} name     - コレクター名
 * @property {string} layer    - 対象レイヤー
 * @property {object|null} data - 収集データ (失敗時null)
 * @property {object} metadata - メタ情報 (件数、所要時間 etc.)
 * @property {string|null} error - エラーメッセージ (成功時null)
 */

const registry = new Map()

/**
 * コレクターを登録
 *
 * @param {string} name - コレクター名 (ドメイン設定の collectors 配列と一致)
 * @param {object} collector
 * @param {string} collector.layer - 対象レイヤー
 * @param {function} collector.collect - async ({ sources, targets, options }) => data
 * @param {string} [collector.description] - 説明
 */
export function register(name, collector) {
  if (!collector.collect || typeof collector.collect !== 'function') {
    throw new Error(`コレクター "${name}" に collect 関数が必要`)
  }
  registry.set(name, collector)
}

/**
 * 登録済みコレクターを取得
 * @param {string} name
 * @returns {object|undefined}
 */
export function get(name) {
  return registry.get(name)
}

/**
 * ドメイン設定から必要なコレクターを解決し、
 * 未登録のものがあれば警告を返す
 *
 * @param {object} domainConfig
 * @returns {{ available: string[], missing: string[] }}
 */
export function resolve(domainConfig) {
  const required = new Set()
  for (const layerName of ['macro', 'competitor', 'user']) {
    const layer = domainConfig.layers[layerName]
    if (layer?.collectors) {
      for (const c of layer.collectors) required.add(c)
    }
  }

  const available = []
  const missing = []
  for (const name of required) {
    if (registry.has(name)) {
      available.push(name)
    } else {
      missing.push(name)
    }
  }

  return { available, missing }
}

/**
 * ドメイン設定に基づき、利用可能な全コレクターを実行
 * 各コレクターは独立して実行され、失敗しても他に影響しない
 *
 * @param {object} domainConfig
 * @param {object} [options] - 追加オプション
 * @returns {Promise<CollectorResult[]>}
 */
export async function runAll(domainConfig, options = {}) {
  const { available, missing } = resolve(domainConfig)

  if (missing.length > 0) {
    console.warn(`[collector-registry] 未登録のコレクター: ${missing.join(', ')}`)
  }

  // ソース情報をレイヤーから逆引き
  const sourceMap = buildSourceMap(domainConfig)

  const promises = available.map(async (name) => {
    const collector = registry.get(name)
    const startTime = Date.now()

    try {
      const data = await collector.collect({
        sources: sourceMap[name] || {},
        targets: domainConfig.targets,
        options: { ...domainConfig.analysis, ...options },
      })

      return {
        name,
        layer: collector.layer,
        data,
        metadata: { duration: Date.now() - startTime },
        error: null,
      }
    } catch (e) {
      console.error(`[collector:${name}] FAIL: ${e.message}`)
      return {
        name,
        layer: collector.layer,
        data: null,
        metadata: { duration: Date.now() - startTime },
        error: e.message,
      }
    }
  })

  return Promise.all(promises)
}

/**
 * ドメイン設定からコレクター名 → ソース設定のマップを構築
 */
function buildSourceMap(domainConfig) {
  const map = {}
  for (const layerName of ['macro', 'competitor', 'user']) {
    const layer = domainConfig.layers[layerName]
    if (!layer?.collectors || !layer?.sources) continue
    for (const collectorName of layer.collectors) {
      if (layer.sources[collectorName]) {
        map[collectorName] = layer.sources[collectorName]
      }
    }
  }
  return map
}

/**
 * 登録済みコレクター一覧を返す
 * @returns {{ name: string, layer: string, description: string }[]}
 */
export function listRegistered() {
  return [...registry.entries()].map(([name, c]) => ({
    name,
    layer: c.layer,
    description: c.description || '',
  }))
}
