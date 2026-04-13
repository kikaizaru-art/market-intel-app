/**
 * Google Play コレクター (拡張版)
 *
 * google-play-scraper (npm) — Google Playの公開データを多角的に収集
 *
 * 収集項目:
 *   - アプリ基本情報 (スコア, インストール数, 開発元)
 *   - 評価ヒストグラム (1-5星の分布 → 感情の偏りを検出)
 *   - What's New (更新内容 → アクション信号として因果エンジンへ)
 *   - バージョン情報 (更新頻度 → 開発活動の活発さ)
 *   - 最新レビュー (テキスト + スコア → センチメント分析)
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import gplay from 'google-play-scraper'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CONFIG_PATH = path.resolve(__dirname, '../../config/targets.json')

export async function fetchStoreReviews(titles) {
  const apps = titles
    ? titles.filter(t => t.store_id_android)
    : JSON.parse(fs.readFileSync(CONFIG_PATH)).titles.filter(t => t.store_id_android)

  const results = []
  for (const app of apps) {
    try {
      console.log(`[store] fetching ${app.name} (${app.store_id_android})...`)

      // アプリ基本情報 (ヒストグラム・What's New・バージョン含む)
      const appInfo = await gplay.app({ appId: app.store_id_android, lang: 'ja', country: 'jp' })

      // 最新レビュー取得
      const reviewData = await gplay.reviews({
        appId: app.store_id_android,
        lang: 'ja',
        country: 'jp',
        sort: gplay.sort.NEWEST,
        num: 30,
      })

      const reviews = reviewData.data.map(r => ({
        id: r.id,
        userName: r.userName,
        score: r.score,
        text: r.text?.slice(0, 300) ?? '',
        date: r.date,
        thumbsUp: r.thumbsUp,
      }))

      // 評価ヒストグラム (1-5星の件数分布)
      const histogram = appInfo.histogram || {}

      // レビュー投稿速度 (直近レビューの日付分布から推定)
      const reviewVelocity = calcReviewVelocity(reviews)

      results.push({
        id: app.id,
        name: app.name,
        genre: app.genre,
        isMain: app.isMain || false,
        store_id: app.store_id_android,
        appInfo: {
          title: appInfo.title,
          score: appInfo.score,
          ratings: appInfo.ratings,
          reviews: appInfo.reviews,
          installs: appInfo.installs,
          developer: appInfo.developer,
          updated: appInfo.updated,
          version: appInfo.version || null,
          recentChanges: appInfo.recentChanges || null,
          histogram: {
            '1': histogram['1'] || 0,
            '2': histogram['2'] || 0,
            '3': histogram['3'] || 0,
            '4': histogram['4'] || 0,
            '5': histogram['5'] || 0,
          },
        },
        recentReviews: reviews,
        reviewVelocity,
      })

      const histTotal = Object.values(histogram).reduce((a, b) => a + (b || 0), 0)
      console.log(`[store]   ${app.name}: score=${appInfo.score}, histogram=${histTotal}, v${appInfo.version || '?'}, ${reviews.length} reviews`)
    } catch (e) {
      console.warn(`[store] failed to fetch ${app.name}:`, e.message)
    }
  }

  if (results.length === 0) {
    console.warn('[store] no real data fetched — returning mock data')
    return JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../data/mock/store-reviews.json')))
  }

  return { source: 'Google Play', fetched_at: new Date().toISOString(), apps: results }
}

/**
 * 直近レビューの投稿速度を算出
 * 「1日あたり何件のレビューが投稿されているか」の推定値
 */
function calcReviewVelocity(reviews) {
  if (reviews.length < 2) return { perDay: 0, span: 0 }
  const dates = reviews
    .map(r => new Date(r.date).getTime())
    .filter(d => !isNaN(d))
    .sort((a, b) => b - a)
  if (dates.length < 2) return { perDay: 0, span: 0 }

  const spanMs = dates[0] - dates[dates.length - 1]
  const spanDays = Math.max(spanMs / (1000 * 60 * 60 * 24), 1)
  return {
    perDay: Math.round((dates.length / spanDays) * 10) / 10,
    span: Math.round(spanDays),
  }
}
