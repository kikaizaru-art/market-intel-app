/**
 * Google Trends コレクター
 *
 * - google-trends-api (非公式) でデータ取得
 * - キーワード: config/targets.json の google_trends.keywords
 * - 取得レンジ: 過去90日（日次）
 * - 出力: data/trends_{YYYY-MM-DD}.json
 */

import fs from 'fs'
import path from 'path'
import googleTrends from 'google-trends-api'

const CONFIG_PATH = new URL('../../config/targets.json', import.meta.url)
const DATA_DIR = new URL('../../data/', import.meta.url)

export async function fetchTrends() {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH))
  const { keywords, geo } = config.google_trends

  console.log('[trends] fetching keywords:', keywords, '| geo:', geo)

  try {
    const result = await googleTrends.interestOverTime({
      keyword: keywords,
      geo,
      startTime: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    })
    const parsed = JSON.parse(result)
    const weekly = parsed.default.timelineData.map(point => ({
      date: new Date(point.time * 1000).toISOString().slice(0, 10),
      ...Object.fromEntries(keywords.map((kw, i) => [kw, point.value[i]])),
    }))
    console.log(`[trends] fetched ${weekly.length} data points`)
    return { source: 'Google Trends', geo, keywords, weekly }
  } catch (e) {
    console.warn('[trends] API fetch failed:', e.message)
    console.warn('[trends] falling back to mock data')
    const mockPath = new URL('../../data/mock/trends.json', import.meta.url)
    return JSON.parse(fs.readFileSync(mockPath))
  }
}

// CLI実行時
if (process.argv[1].includes('trends.js')) {
  fetchTrends().then(data => {
    const outPath = path.join(DATA_DIR.pathname, `trends_${new Date().toISOString().slice(0, 10)}.json`)
    fs.writeFileSync(outPath, JSON.stringify(data, null, 2))
    console.log('[trends] saved to', outPath)
  }).catch(console.error)
}
