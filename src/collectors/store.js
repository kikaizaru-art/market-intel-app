/**
 * App Store / Google Play コレクター
 *
 * 取得方法:
 *   - app-store-scraper (npm) — App Storeのレビュー、評価、ランキング
 *   - google-play-scraper (npm) — Google Playのレビュー、評価
 *
 * 公開データのみ使用（スクレイピング利用規約の範囲内）
 */

import fs from 'fs'

// TODO: npm i app-store-scraper google-play-scraper
// import gplay from 'google-play-scraper'
// import store from 'app-store-scraper'

export async function fetchStoreReviews({ appId, platform = 'ios', country = 'jp' } = {}) {
  if (!appId) {
    console.warn('[store] no appId provided — returning mock data')
    return JSON.parse(fs.readFileSync(new URL('../../data/mock/store-reviews.json', import.meta.url)))
  }

  // --- iOS 実装予定 ---
  // if (platform === 'ios') {
  //   const reviews = await store.reviews({ id: appId, country, page: 1 })
  //   const ratings = await store.app({ id: appId, country })
  //   return { score: ratings.score, reviews: reviews.slice(0, 50) }
  // }
  // --- /iOS 実装予定 ---

  // --- Android 実装予定 ---
  // if (platform === 'android') {
  //   const reviews = await gplay.reviews({ appId, lang: 'ja', country, sort: gplay.sort.NEWEST })
  //   const app = await gplay.app({ appId })
  //   return { score: app.score, reviews: reviews.data.slice(0, 50) }
  // }
  // --- /Android 実装予定 ---
}

export async function fetchStoreRankings({ genre = 'GAME', country = 'jp' } = {}) {
  // TODO: App Store / Google Playのランキングを取得
  // gplay.list({ category: gplay.category.GAME_PUZZLE, collection: gplay.collection.TOP_FREE, country })
  console.log('[store] fetchStoreRankings — not yet implemented')
  return []
}

// CLI実行時
if (process.argv[1].includes('store.js')) {
  fetchStoreReviews({ appId: '123456789', platform: 'ios' }).then(data => {
    console.log('[store] fetched reviews:', data?.apps?.length ?? 0, 'apps')
  }).catch(console.error)
}
