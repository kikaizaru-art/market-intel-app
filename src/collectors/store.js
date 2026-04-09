/**
 * Google Play コレクター
 *
 * google-play-scraper (npm) — Google Playのレビュー、評価、アプリ情報
 * 公開データのみ使用
 */

import fs from 'fs'
import gplay from 'google-play-scraper'

const CONFIG_PATH = new URL('../../config/targets.json', import.meta.url)

export async function fetchStoreReviews() {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH))
  const apps = config.titles.filter(t => t.store_id_android)

  const results = []
  for (const app of apps) {
    try {
      console.log(`[store] fetching ${app.name} (${app.store_id_android})...`)

      // アプリ基本情報
      const appInfo = await gplay.app({ appId: app.store_id_android, lang: 'ja', country: 'jp' })

      // 最新レビュー取得
      const reviewData = await gplay.reviews({
        appId: app.store_id_android,
        lang: 'ja',
        country: 'jp',
        sort: gplay.sort.NEWEST,
        num: 20,
      })

      const reviews = reviewData.data.map(r => ({
        id: r.id,
        userName: r.userName,
        score: r.score,
        text: r.text?.slice(0, 300) ?? '',
        date: r.date,
        thumbsUp: r.thumbsUp,
      }))

      results.push({
        id: app.id,
        name: app.name,
        genre: app.genre,
        store_id: app.store_id_android,
        appInfo: {
          title: appInfo.title,
          score: appInfo.score,
          ratings: appInfo.ratings,
          reviews: appInfo.reviews,
          installs: appInfo.installs,
          developer: appInfo.developer,
          updated: appInfo.updated,
        },
        recentReviews: reviews,
      })
      console.log(`[store]   ${app.name}: score=${appInfo.score}, ${reviews.length} reviews`)
    } catch (e) {
      console.warn(`[store] failed to fetch ${app.name}:`, e.message)
    }
  }

  if (results.length === 0) {
    console.warn('[store] no real data fetched — returning mock data')
    return JSON.parse(fs.readFileSync(new URL('../../data/mock/store-reviews.json', import.meta.url)))
  }

  return { source: 'Google Play', fetched_at: new Date().toISOString(), apps: results }
}
