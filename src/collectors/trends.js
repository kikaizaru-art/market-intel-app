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

export async function fetchTrends() {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH))
  const { keywords, geo } = config.google_trends

  console.log('[trends] fetching keywords:', keywords, '| geo:', geo)

  const pyScript = `
import json, sys
from pytrends.request import TrendReq

keywords = json.loads(sys.argv[1])
geo = sys.argv[2]

pytrends = TrendReq(hl='ja-JP', tz=-540)
pytrends.build_payload(keywords, cat=0, timeframe='today 3-m', geo=geo)
df = pytrends.interest_over_time()

if df.empty:
    print(json.dumps([]))
else:
    df = df.drop(columns=['isPartial'], errors='ignore')
    df.index = df.index.strftime('%Y-%m-%d')
    rows = [{"date": date, **{k: int(v) for k, v in row.items()}} for date, row in df.to_dict('index').items()]
    print(json.dumps(rows, ensure_ascii=False))
`

  try {
    const result = execSync(
      `python -c ${JSON.stringify(pyScript)} ${JSON.stringify(JSON.stringify(keywords))} ${geo}`,
      { encoding: 'utf-8', timeout: 30000 }
    )
    const weekly = JSON.parse(result.trim())
    if (weekly.length === 0) throw new Error('empty result')
    console.log(`[trends] fetched ${weekly.length} data points via pytrends`)
    return { source: 'Google Trends', geo, keywords, weekly }
  } catch (e) {
    console.warn('[trends] pytrends failed:', e.message?.split('\n')[0])
    console.warn('[trends] falling back to mock data')
    const mockPath = path.resolve(__dirname, '../../data/mock/trends.json')
    return JSON.parse(fs.readFileSync(mockPath))
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
