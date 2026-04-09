/**
 * データ収集エントリーポイント
 * npm run collect で実行
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
const CONFIG_PATH = path.resolve(__dirname, '../../config/targets.json')

async function run() {
  console.log('=== Market Intel Collector ===')
  const today = new Date().toISOString().slice(0, 10)
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH))

  // data ディレクトリ作成
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

  // 1. Google Trends
  console.log('\n[1/4] Google Trends...')
  const trends = await fetchTrends()
  fs.writeFileSync(path.join(DATA_DIR, `trends_${today}.json`), JSON.stringify(trends, null, 2))
  console.log('  ✓ saved')

  // 2. Meta Ads
  console.log('\n[2/4] Meta Ad Library...')
  const searchTerms = config.titles.map(t => t.name)
  const ads = await fetchMetaAds({ searchTerms })
  fs.writeFileSync(path.join(DATA_DIR, `meta-ads_${today}.json`), JSON.stringify(ads, null, 2))
  console.log('  ✓ saved')

  // 3. Store Reviews
  console.log('\n[3/4] Store Reviews (Google Play)...')
  const reviews = await fetchStoreReviews()
  fs.writeFileSync(path.join(DATA_DIR, `store-reviews_${today}.json`), JSON.stringify(reviews, null, 2))
  console.log('  ✓ saved')

  // 4. News
  console.log('\n[4/4] News RSS...')
  const news = await fetchNews()
  fs.writeFileSync(path.join(DATA_DIR, `news_${today}.json`), JSON.stringify(news, null, 2))
  console.log('  ✓ saved')

  console.log('\n=== Done ===')
}

run().catch(console.error)
