/**
 * データ収集エントリーポイント (Phase 2)
 * npm run collect で実行
 *
 * 各コレクターは独立して動作し、失敗しても他のコレクターに影響しない
 */

import { fetchTrends } from './trends.js'
import { fetchMetaAds } from './meta-ads.js'
import { fetchStoreReviews } from './store.js'
import { fetchNews } from './news.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.resolve(__dirname, '../../data')
const PUBLIC_DATA_DIR = path.resolve(__dirname, '../../public/data')
const CONFIG_PATH = path.resolve(__dirname, '../../config/targets.json')

function saveJson(filepath, data) {
  fs.mkdirSync(path.dirname(filepath), { recursive: true })
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2))
}

async function run() {
  console.log('=== Market Intel Collector (Phase 2) ===')
  console.log(`[info] started at ${new Date().toISOString()}`)
  const today = new Date().toISOString().slice(0, 10)

  let config
  try {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH))
    console.log(`[info] config loaded: ${config.titles.length} titles, ${config.google_trends.keywords.length} keywords`)
  } catch (e) {
    console.error('[FATAL] config/targets.json not found or invalid:', e.message)
    process.exit(1)
  }

  fs.mkdirSync(DATA_DIR, { recursive: true })

  const results = { collected_at: new Date().toISOString() }
  const errors = []

  // 1. Google Trends
  console.log('\n[1/4] Google Trends...')
  try {
    results.trends = await fetchTrends()
    saveJson(path.join(DATA_DIR, `trends_${today}.json`), results.trends)
    const points = results.trends?.weekly?.length ?? 0
    console.log(`  OK: ${points} data points`)
  } catch (e) {
    console.error(`  FAIL: ${e.message}`)
    errors.push({ collector: 'trends', error: e.message })
    results.trends = null
  }

  // 2. Meta Ads
  console.log('\n[2/4] Meta Ad Library...')
  try {
    const searchTerms = config.titles.map(t => t.name)
    results.ads = await fetchMetaAds({ searchTerms })
    saveJson(path.join(DATA_DIR, `meta-ads_${today}.json`), results.ads)
    const count = results.ads?.ads?.length ?? 0
    console.log(`  OK: ${count} ads`)
  } catch (e) {
    console.error(`  FAIL: ${e.message}`)
    errors.push({ collector: 'meta-ads', error: e.message })
    results.ads = null
  }

  // 3. Store Reviews
  console.log('\n[3/4] Store Reviews (Google Play)...')
  try {
    results.reviews = await fetchStoreReviews()
    saveJson(path.join(DATA_DIR, `store-reviews_${today}.json`), results.reviews)
    const count = results.reviews?.apps?.length ?? 0
    console.log(`  OK: ${count} apps`)
  } catch (e) {
    console.error(`  FAIL: ${e.message}`)
    errors.push({ collector: 'store', error: e.message })
    results.reviews = null
  }

  // 4. News
  console.log('\n[4/4] News RSS...')
  try {
    results.news = await fetchNews()
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
  const succeeded = 4 - errors.length
  console.log(`\n=== Done: ${succeeded}/4 collectors succeeded ===`)
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
