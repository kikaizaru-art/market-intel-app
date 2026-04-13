/**
 * Google Trends コレクター
 *
 * pytrends (Python) 経由でデータ取得
 * - キーワード: config/targets.json の google_trends.keywords
 * - 取得レンジ: 過去90日
 * - 出力: data/trends_{YYYY-MM-DD}.json
 *
 * 事前準備: pip install pytrends
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CONFIG_PATH = path.resolve(__dirname, '../../config/targets.json')
const DATA_DIR = path.resolve(__dirname, '../../data')
const PY_SCRIPT = path.resolve(__dirname, 'fetch_trends.py')

export async function fetchTrends(trendsConfig) {
  const { keywords, geo } = trendsConfig || JSON.parse(fs.readFileSync(CONFIG_PATH)).google_trends

  console.log('[trends] fetching keywords:', keywords, '| geo:', geo)

  try {
    const result = execSync(
      `python "${PY_SCRIPT}" ${JSON.stringify(JSON.stringify(keywords))} ${geo}`,
      { encoding: 'utf-8', timeout: 300000, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }
    )
    const weekly = JSON.parse(result.trim())
    if (weekly.length === 0) throw new Error('empty result')
    console.log(`[trends] fetched ${weekly.length} data points via pytrends`)
    return { source: 'Google Trends', geo, keywords, weekly }
  } catch (e) {
    console.warn('[trends] pytrends failed:', e.message?.split('\n')[0])

    // モックファイルがあり、キーワードが一致する場合のみ使用
    const mockPath = path.resolve(__dirname, '../../data/mock/trends.json')
    if (fs.existsSync(mockPath)) {
      const mock = JSON.parse(fs.readFileSync(mockPath))
      const mockKeys = mock.keywords || Object.keys(mock.weekly?.[0] || {}).filter(k => k !== 'date')
      const isMatch = keywords.some(k => mockKeys.includes(k))
      if (isMatch) {
        console.warn('[trends] falling back to mock data (keywords match)')
        return mock
      }
    }

    // モックが合わない場合、指定キーワードで空データを返す
    console.warn('[trends] no matching mock — returning empty structure for:', keywords)
    return { source: 'Google Trends (empty)', geo, keywords, weekly: [] }
  }
}

// CLI実行時
if (process.argv[1].includes('trends.js')) {
  fetchTrends().then(data => {
    const outPath = path.join(DATA_DIR, `trends_${new Date().toISOString().slice(0, 10)}.json`)
    fs.writeFileSync(outPath, JSON.stringify(data, null, 2))
    console.log('[trends] saved to', outPath)
  }).catch(console.error)
}
