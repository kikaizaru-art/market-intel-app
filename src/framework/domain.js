/**
 * ドメインローダー & マネージャー
 *
 * config/domains/{domain}.json を読み込み、
 * フレームワーク全体にドメイン設定を提供する。
 *
 * 環境変数 DOMAIN=stock npm run collect のように切り替え可能。
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DOMAINS_DIR = path.resolve(__dirname, '../../config/domains')

const REQUIRED_LAYERS = ['macro', 'competitor', 'user', 'causal']

/**
 * ドメイン設定を検証
 */
function validateDomainConfig(config) {
  const errors = []

  if (!config.domain) errors.push('domain フィールドが必須')
  if (!config.name) errors.push('name フィールドが必須')
  if (!config.layers) errors.push('layers フィールドが必須')

  if (config.layers) {
    for (const layer of REQUIRED_LAYERS) {
      if (!config.layers[layer]) {
        errors.push(`layers.${layer} が必須`)
      }
    }
  }

  if (!config.targets || !Array.isArray(config.targets)) {
    errors.push('targets 配列が必須')
  }

  if (!config.dataPrefix) errors.push('dataPrefix フィールドが必須')

  if (errors.length > 0) {
    throw new Error(`ドメイン設定エラー (${config.domain || 'unknown'}):\n  - ${errors.join('\n  - ')}`)
  }

  return true
}

/**
 * ドメイン設定ファイルを読み込み
 * @param {string} domainName - ドメイン名 (例: "game-market", "stock", "keiba")
 * @returns {object} ドメイン設定
 */
export function loadDomain(domainName) {
  const filepath = path.join(DOMAINS_DIR, `${domainName}.json`)

  if (!fs.existsSync(filepath)) {
    throw new Error(`ドメイン設定が見つからない: ${filepath}`)
  }

  const config = JSON.parse(fs.readFileSync(filepath, 'utf8'))
  validateDomainConfig(config)
  return config
}

/**
 * 利用可能なドメイン一覧を返す
 * @returns {{ domain: string, name: string, version: string }[]}
 */
export function listDomains() {
  if (!fs.existsSync(DOMAINS_DIR)) return []

  return fs.readdirSync(DOMAINS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const config = JSON.parse(fs.readFileSync(path.join(DOMAINS_DIR, f), 'utf8'))
      return {
        domain: config.domain,
        name: config.name,
        version: config.version,
        file: f,
      }
    })
}

/**
 * アクティブなドメインを決定
 * 優先順位: 環境変数 DOMAIN > デフォルト "game-market"
 * @returns {object} ドメイン設定
 */
export function getActiveDomain() {
  const domainName = process.env.DOMAIN || 'game-market'
  return loadDomain(domainName)
}

/**
 * ドメイン設定からレイヤー定義を取得
 * @param {object} domainConfig
 * @param {string} layerName - "macro" | "competitor" | "user" | "causal"
 * @returns {object} レイヤー設定
 */
export function getLayer(domainConfig, layerName) {
  const layer = domainConfig.layers[layerName]
  if (!layer) {
    throw new Error(`レイヤー "${layerName}" がドメイン "${domainConfig.domain}" に存在しない`)
  }
  return layer
}

/**
 * ドメイン設定から全コレクター名を抽出 (causal層を除く)
 * @param {object} domainConfig
 * @returns {string[]} コレクター名の配列（重複除去済み）
 */
export function getRequiredCollectors(domainConfig) {
  const collectors = new Set()
  for (const layerName of ['macro', 'competitor', 'user']) {
    const layer = domainConfig.layers[layerName]
    if (layer?.collectors) {
      for (const c of layer.collectors) {
        collectors.add(c)
      }
    }
  }
  return [...collectors]
}

/**
 * ドメイン設定から分析パラメータを取得（デフォルト値付き）
 * @param {object} domainConfig
 * @returns {object}
 */
export function getAnalysisParams(domainConfig) {
  return {
    anomalyThreshold: 2.0,
    trendWindow: 4,
    causationWindowDays: 7,
    autoConfirmThreshold: 0.65,
    autoRejectThreshold: 0.30,
    ...domainConfig.analysis,
  }
}
