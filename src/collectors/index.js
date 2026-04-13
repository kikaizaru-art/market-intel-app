/**
 * データ収集エントリーポイント
 *
 * ドメインフレームワーク対応:
 *   DOMAIN=memento-mori npm run collect
 *   DOMAIN=game-market npm run collect (デフォルト)
 *
 * ドメイン設定 (config/domains/{domain}.json) から
 * targets / sources / keywords を自動解決する。
 */

import { fetchTrends } from './trends.js'
import { fetchStoreReviews } from './store.js'
import { fetchNews } from './news.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.resolve(__dirname, '../../data')
const PUBLIC_DATA_DIR = path.resolve(__dirname, '../../public/data')
const CONFIG_DIR = path.resolve(__dirname, '../../config')
const DOMAINS_DIR = path.resolve(CONFIG_DIR, 'domains')

function saveJson(filepath, data) {
  fs.mkdirSync(path.dirname(filepath), { recursive: true })
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2))
}

/**
 * ドメイン設定を読み込み、targets.json 互換の設定を生成
 */
function loadDomainConfig(domainName) {
  const domainPath = path.join(DOMAINS_DIR, `${domainName}.json`)
  if (!fs.existsSync(domainPath)) {
    throw new Error(`ドメイン設定が見つからない: ${domainPath}`)
  }
  const domain = JSON.parse(fs.readFileSync(domainPath, 'utf8'))

  // ドメイン設定から targets.json 互換形式を構築
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
  }

  return { domain, config }
}

async function run() {
  const domainName = process.env.DOMAIN || 'game-market'
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
  const feeds = config.news_rss?.feeds

  // 1. Google Trends
  console.log('\n[1/3] Google Trends...')
  try {
    results.trends = await fetchTrends(config.google_trends)
    saveJson(path.join(DATA_DIR, `trends_${today}.json`), results.trends)
    const points = results.trends?.weekly?.length ?? 0
    console.log(`  OK: ${points} data points`)
  } catch (e) {
    console.error(`  FAIL: ${e.message}`)
    errors.push({ collector: 'trends', error: e.message })
    results.trends = null
  }

  // 2. Store Reviews
  console.log('\n[2/3] Store Reviews (Google Play)...')
  try {
    results.reviews = await fetchStoreReviews(config.titles)
    saveJson(path.join(DATA_DIR, `store-reviews_${today}.json`), results.reviews)
    const count = results.reviews?.apps?.length ?? 0
    console.log(`  OK: ${count} apps`)
  } catch (e) {
    console.error(`  FAIL: ${e.message}`)
    errors.push({ collector: 'store', error: e.message })
    results.reviews = null
  }

  // 3. News
  console.log('\n[3/3] News RSS...')
  try {
    results.news = await fetchNews(feeds)
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
  const succeeded = 3 - errors.length
  console.log(`\n=== Done: ${succeeded}/3 collectors succeeded (${domainName}) ===`)
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
