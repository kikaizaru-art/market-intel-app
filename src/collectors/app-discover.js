/**
 * アプリ自動探索 & ドメイン設定生成
 *
 * Google Play の公開情報から対象アプリの周辺環境を自動導出する。
 *
 * 使い方:
 *   node src/collectors/app-discover.js <package_id> [--domain <name>]
 *
 * 例:
 *   node src/collectors/app-discover.js jp.boi.mementomori.android
 *   node src/collectors/app-discover.js jp.boi.mementomori.android --domain memento-mori
 *
 * 出力:
 *   - config/domains/{domain}.json  — ドメイン設定
 *   - config/targets.json           — コレクター用ターゲット (上書き)
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import gplay from 'google-play-scraper'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CONFIG_DIR = path.resolve(__dirname, '../../config')
const DOMAINS_DIR = path.resolve(CONFIG_DIR, 'domains')

// ジャンル別 RSS フィード定義
const GENRE_RSS_MAP = {
  'ゲーム': [
    { name: '4Gamer', url: 'https://www.4gamer.net/rss/index.xml' },
    { name: 'AUTOMATON', url: 'https://automaton-media.com/feed/' },
    { name: 'Inside', url: 'https://www.inside-games.jp/rss/index.rdf' },
    { name: 'GameSpark', url: 'https://www.gamespark.jp/rss/index.rdf' },
  ],
  'GAME': [
    { name: '4Gamer', url: 'https://www.4gamer.net/rss/index.xml' },
    { name: 'AUTOMATON', url: 'https://automaton-media.com/feed/' },
    { name: 'Inside', url: 'https://www.inside-games.jp/rss/index.rdf' },
    { name: 'GameSpark', url: 'https://www.gamespark.jp/rss/index.rdf' },
  ],
  'default': [
    { name: 'ITmedia', url: 'https://rss.itmedia.co.jp/rss/2.0/itmedia_all.xml' },
    { name: 'TechCrunch JP', url: 'https://jp.techcrunch.com/feed/' },
  ],
}

// Google Play ジャンルID → 日本語カテゴリ
const GENRE_ID_MAP = {
  GAME_ROLE_PLAYING: 'RPG',
  GAME_ACTION: 'アクション',
  GAME_STRATEGY: 'ストラテジー',
  GAME_PUZZLE: 'パズル',
  GAME_CASUAL: 'カジュアル',
  GAME_SIMULATION: 'シミュレーション',
  GAME_ADVENTURE: 'アドベンチャー',
  GAME_CARD: 'カードゲーム',
  GAME_SPORTS: 'スポーツ',
}

/**
 * アプリIDからドメイン名を推測
 */
function inferDomainName(appId) {
  // jp.boi.mementomori.android → mementomori
  const parts = appId.split('.')
  // "android", "app" などのサフィックスを除去
  const filtered = parts.filter(p => !['jp', 'com', 'co', 'android', 'app', 'ios', 'net', 'org'].includes(p))
  // 最も長い部分をドメイン名とする (アプリ名である可能性が高い)
  return filtered.sort((a, b) => b.length - a.length)[0] || parts[parts.length - 2]
}

/**
 * アプリ名から Google Trends 用キーワードを生成
 */
function generateKeywords(mainApp, competitors) {
  const keywords = [mainApp.title]
  // 競合アプリから上位3つ追加 (合計最大5キーワード — Trends API の制限)
  for (const comp of competitors.slice(0, 3)) {
    keywords.push(comp.title)
  }
  return keywords.slice(0, 5)
}

/**
 * ジャンルから適切な RSS フィードを選択
 */
function selectRssFeeds(genreId, genre) {
  if (genreId?.startsWith('GAME_') || genre?.includes('ゲーム')) {
    return GENRE_RSS_MAP['ゲーム']
  }
  return GENRE_RSS_MAP['default']
}

/**
 * ジャンルからカテゴリリストを生成
 */
function generateCategories(genreId) {
  if (genreId?.startsWith('GAME_')) {
    return ['RPG', 'アクション', 'パズル', 'ストラテジー', 'シミュレーション', 'カジュアル']
  }
  return []
}

/**
 * Google Play から対象アプリの情報を取得
 */
async function fetchAppInfo(appId) {
  console.log(`[discover] アプリ情報を取得: ${appId}`)
  const info = await gplay.app({ appId, lang: 'ja', country: 'jp' })
  return {
    appId: info.appId,
    title: info.title,
    developer: info.developer,
    developerId: info.developerId,
    genre: info.genre,
    genreId: info.genreId,
    score: info.score,
    ratings: info.ratings,
    installs: info.installs,
    description: info.summary?.slice(0, 300) || '',
    updated: info.updated,
  }
}

/**
 * Google Play の「類似アプリ」から競合を自動発見
 */
async function fetchSimilarApps(appId, limit = 5) {
  console.log(`[discover] 類似アプリを探索: ${appId}`)
  try {
    const similar = await gplay.similar({ appId, lang: 'ja', country: 'jp' })
    return similar.slice(0, limit).map(app => ({
      appId: app.appId,
      title: app.title,
      developer: app.developer,
      score: app.score,
      genre: app.genre,
    }))
  } catch (e) {
    console.warn(`[discover] 類似アプリ取得失敗: ${e.message}`)
    return []
  }
}

/**
 * ドメイン設定 JSON を生成
 */
function buildDomainConfig({ domainName, mainApp, competitors, rssFeeds, keywords }) {
  const category = GENRE_ID_MAP[mainApp.genreId] || mainApp.genre || ''
  const developers = [...new Set([mainApp.developer, ...competitors.map(c => c.developer)])]

  return {
    domain: domainName,
    name: `${mainApp.title} 市場分析`,
    version: '1.0.0',
    description: `${mainApp.title} の市場環境・競合動向・ユーザー反応を多層的に収集・分析`,

    layers: {
      macro: {
        label: 'マクロ環境',
        description: '市場全体の潮流 — ジャンルトレンド・業界ニュース',
        collectors: ['google-trends', 'news-rss'],
        sources: {
          'google-trends': { keywords, geo: 'JP' },
          'news-rss': { feeds: rssFeeds },
        },
      },
      competitor: {
        label: '競合動向',
        description: '競合アプリのストア情報・レビュー',
        collectors: ['store-reviews'],
        sources: {
          'store-reviews': { platform: 'google-play' },
        },
      },
      user: {
        label: 'ユーザー反応',
        description: 'アプリレビュー・SNSセンチメント',
        collectors: ['store-reviews'],
        sources: {},
      },
      causal: {
        label: '因果関係',
        description: 'イベント×トレンド異常値の自動相関検出',
        autoMemo: true,
        validationEnabled: true,
        learningEnabled: true,
      },
    },

    targets: [
      {
        id: domainName,
        name: mainApp.title,
        category,
        isMain: true,
        identifiers: {
          store_id_android: mainApp.appId,
        },
      },
      ...competitors.map(comp => ({
        id: comp.appId.split('.').pop(),
        name: comp.title,
        category: GENRE_ID_MAP[comp.genreId] || comp.genre || category,
        isMain: false,
        identifiers: {
          store_id_android: comp.appId,
        },
      })),
    ],

    categories: generateCategories(mainApp.genreId),
    competitors: developers.slice(1), // メイン開発元は除外

    analysis: {
      anomalyThreshold: 2.0,
      trendWindow: 4,
      causationWindowDays: 7,
      autoConfirmThreshold: 0.65,
      autoRejectThreshold: 0.30,
    },

    dataPrefix: domainName,
  }
}

/**
 * ドメイン設定から targets.json を生成
 */
function buildTargetsJson(domainConfig) {
  const keywords = domainConfig.layers.macro.sources['google-trends']?.keywords || []
  return {
    titles: domainConfig.targets.map(t => ({
      id: t.id,
      name: t.name,
      genre: t.category,
      store_id_android: t.identifiers.store_id_android,
      ...(t.identifiers.store_id_ios ? { store_id_ios: t.identifiers.store_id_ios } : {}),
    })),
    genres: domainConfig.categories,
    competitors: domainConfig.competitors,
    google_trends: {
      keywords,
      geo: 'JP',
    },
  }
}

/**
 * メインの探索・生成フロー
 */
export async function discover(appId, options = {}) {
  const domainName = options.domain || inferDomainName(appId)
  console.log(`\n=== App Discover: ${appId} → domain "${domainName}" ===\n`)

  // 1. アプリ情報を取得
  const mainApp = await fetchAppInfo(appId)
  console.log(`[discover] アプリ: ${mainApp.title} (${mainApp.developer})`)
  console.log(`[discover] ジャンル: ${mainApp.genre} (${mainApp.genreId})`)
  console.log(`[discover] 評価: ${mainApp.score} (${mainApp.ratings} ratings)`)

  // 2. 類似アプリから競合を発見
  const competitors = await fetchSimilarApps(appId, 5)
  console.log(`[discover] 競合 ${competitors.length} 件:`)
  for (const c of competitors) {
    console.log(`  - ${c.title} (${c.developer}) ★${c.score}`)
  }

  // 3. RSS フィードを選択
  const rssFeeds = selectRssFeeds(mainApp.genreId, mainApp.genre)

  // 4. キーワードを生成
  const keywords = generateKeywords(mainApp, competitors)
  console.log(`[discover] Trends キーワード: ${keywords.join(', ')}`)

  // 5. ドメイン設定を生成
  const domainConfig = buildDomainConfig({ domainName, mainApp, competitors, rssFeeds, keywords })

  // 6. ファイル出力
  fs.mkdirSync(DOMAINS_DIR, { recursive: true })
  const domainPath = path.join(DOMAINS_DIR, `${domainName}.json`)
  fs.writeFileSync(domainPath, JSON.stringify(domainConfig, null, 2))
  console.log(`\n[discover] ドメイン設定を保存: ${domainPath}`)

  const targetsJson = buildTargetsJson(domainConfig)
  const targetsPath = path.join(CONFIG_DIR, 'targets.json')
  fs.writeFileSync(targetsPath, JSON.stringify(targetsJson, null, 2))
  console.log(`[discover] targets.json を更新: ${targetsPath}`)

  console.log(`\n=== 完了 ===`)
  console.log(`収集実行: DOMAIN=${domainName} npm run collect`)

  return domainConfig
}

// CLI 実行
if (process.argv[1]?.includes('app-discover')) {
  const appId = process.argv[2]
  if (!appId) {
    console.error('Usage: node src/collectors/app-discover.js <package_id> [--domain <name>]')
    console.error('Example: node src/collectors/app-discover.js jp.boi.mementomori.android')
    process.exit(1)
  }

  const domainIdx = process.argv.indexOf('--domain')
  const domain = domainIdx !== -1 ? process.argv[domainIdx + 1] : undefined

  discover(appId, { domain }).catch(e => {
    console.error('[discover] FATAL:', e.message)
    process.exit(1)
  })
}
