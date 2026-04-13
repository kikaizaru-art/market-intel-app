/**
 * データ収集エントリーポイント
 *
 * ドメインフレームワーク対応:
 *   DOMAIN=memento-mori npm run collect
 *   DOMAIN=game-market npm run collect (デフォルト)
 *
 * 6コレクター体制:
 *   1. Google Trends   — 検索トレンド推移 (マクロ)
 *   2. Store Reviews   — レビュー・評価・ヒストグラム・What's New (ユーザー+アクション)
 *   3. Store Ranking   — カテゴリ別順位 (競合ポジション)
 *   4. Community        — Reddit コミュニティ活動 (先行指標)
 *   5. News RSS        — 業界ニュース (マクロ)
 *
 * ドメイン設定 (config/domains/{domain}.json) から
 * targets / sources / keywords を自動解決する。
 */

import { fetchTrends } from './trends.js'
import { fetchStoreReviews } from './store.js'
import { fetchStoreRanking } from './store-ranking.js'
import { fetchCommunity } from './community.js'
import { fetchNews } from './news.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.resolve(__dirname, '../../data')
const PUBLIC_DATA_DIR = path.resolve(__dirname, '../../public/data')
const CONFIG_DIR = path.resolve(__dirname, '../../config')
const DOMAINS_DIR = path.resolve(CONFIG_DIR, 'domains')
const TOTAL_COLLECTORS = 5

function saveJson(filepath, data) {
  fs.mkdirSync(path.dirname(filepath), { recursive: true })
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2))
}

/**
 * ドメイン設定を読み込み、各コレクター用のパラメータを構築
 */
function loadDomainConfig(domainName) {
  const domainPath = path.join(DOMAINS_DIR, `${domainName}.json`)
  if (!fs.existsSync(domainPath)) {
    throw new Error(`ドメイン設定が見つからない: ${domainPath}`)
  }
  const domain = JSON.parse(fs.readFileSync(domainPath, 'utf8'))

  const config = {
    titles: domain.targets.map(t => ({
      id: t.id,
      name: t.name,
      genre: t.category,
      store_id_android: t.identifiers?.store_id_android,
      store_id_ios: t.identifiers?.store_id_ios,
      isMain: t.isMain || false,
    })),
    genres: domain.categories || [],
    competitors: domain.competitors || [],
    google_trends: domain.layers?.macro?.sources?.['google-trends'] || { keywords: [], geo: 'JP' },
    news_rss: domain.layers?.macro?.sources?.['news-rss'] || { feeds: [] },
    community: domain.layers?.user?.sources?.community || {},
  }

  return { domain, config }
}

async function run() {
  // --domain 引数 > 環境変数 DOMAIN > デフォルト game-market
  const domainArg = process.argv.indexOf('--domain')
  const domainName = (domainArg !== -1 ? process.argv[domainArg + 1] : process.env.DOMAIN || 'game-market').trim()
  console.log(`=== Market Intel Collector ===`)
  console.log(`[info] domain: ${domainName}`)
  console.log(`[info] started at ${new Date().toISOString()}`)
  const today = new Date().toISOString().slice(0, 10)

  let domain, config
  try {
    const loaded = loadDomainConfig(domainName)
    domain = loaded.domain
    config = loaded.config
    console.log(`[info] ${domain.name}: ${config.titles.length} targets, ${config.google_trends.keywords.length} keywords`)
  } catch (e) {
    console.error('[FATAL] ドメイン設定の読み込みに失敗:', e.message)
    process.exit(1)
  }

  fs.mkdirSync(DATA_DIR, { recursive: true })

  const results = { collected_at: new Date().toISOString(), domain: domainName }
  const errors = []

  // 1. Google Trends
  console.log(`\n[1/${TOTAL_COLLECTORS}] Google Trends...`)
  try {
    results.trends = await fetchTrends(config.google_trends)
    saveJson(path.join(DATA_DIR, `trends_${today}.json`), results.trends)
    console.log(`  OK: ${results.trends?.weekly?.length ?? 0} data points`)
  } catch (e) {
    console.error(`  FAIL: ${e.message}`)
    errors.push({ collector: 'trends', error: e.message })
    results.trends = null
  }

  // 2. Store Reviews + Detail (ヒストグラム, What's New, バージョン)
  console.log(`\n[2/${TOTAL_COLLECTORS}] Store Reviews & Detail (Google Play)...`)
  try {
    results.reviews = await fetchStoreReviews(config.titles)
    saveJson(path.join(DATA_DIR, `store-reviews_${today}.json`), results.reviews)
    console.log(`  OK: ${results.reviews?.apps?.length ?? 0} apps`)
  } catch (e) {
    console.error(`  FAIL: ${e.message}`)
    errors.push({ collector: 'store', error: e.message })
    results.reviews = null
  }

  // 3. Store Ranking (カテゴリ別順位)
  console.log(`\n[3/${TOTAL_COLLECTORS}] Store Ranking...`)
  try {
    results.ranking = await fetchStoreRanking(config.titles)
    saveJson(path.join(DATA_DIR, `store-ranking_${today}.json`), results.ranking)
    const positions = results.ranking?.targetPositions?.length ?? 0
    console.log(`  OK: ${positions} targets ranked`)
  } catch (e) {
    console.error(`  FAIL: ${e.message}`)
    errors.push({ collector: 'ranking', error: e.message })
    results.ranking = null
  }

  // 4. Community (Reddit)
  console.log(`\n[4/${TOTAL_COLLECTORS}] Community (Reddit)...`)
  try {
    const keywords = config.titles.filter(t => t.isMain).map(t => t.name)
    if (keywords.length === 0) keywords.push(config.titles[0]?.name)
    const subreddits = config.community?.subreddits || []
    results.community = await fetchCommunity(keywords, { subreddits })
    saveJson(path.join(DATA_DIR, `community_${today}.json`), results.community)
    console.log(`  OK: ${results.community?.stats?.totalPosts ?? 0} posts`)
  } catch (e) {
    console.error(`  FAIL: ${e.message}`)
    errors.push({ collector: 'community', error: e.message })
    results.community = null
  }

  // 5. News RSS
  console.log(`\n[5/${TOTAL_COLLECTORS}] News RSS...`)
  try {
    results.news = await fetchNews(config.news_rss?.feeds)
    saveJson(path.join(DATA_DIR, `news_${today}.json`), results.news)
    console.log(`  OK: ${results.news?.length ?? 0} articles`)
  } catch (e) {
    console.error(`  FAIL: ${e.message}`)
    errors.push({ collector: 'news', error: e.message })
    results.news = null
  }

  // ダッシュボード用に統合ファイルを出力
  fs.mkdirSync(PUBLIC_DATA_DIR, { recursive: true })
  saveJson(path.join(PUBLIC_DATA_DIR, 'collected.json'), results)
  console.log('\n  public/data/collected.json saved')

  // サマリー
  const succeeded = TOTAL_COLLECTORS - errors.length
  console.log(`\n=== Done: ${succeeded}/${TOTAL_COLLECTORS} collectors succeeded (${domainName}) ===`)
  if (errors.length > 0) {
    console.log('Failures:')
    for (const err of errors) {
      console.log(`  - ${err.collector}: ${err.error}`)
    }
  }
}

run().catch(e => {
  console.error('[FATAL] Collector crashed:', e.message)
  process.exit(1)
})
