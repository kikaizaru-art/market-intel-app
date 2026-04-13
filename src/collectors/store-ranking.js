/**
 * Google Play カテゴリランキング コレクター
 *
 * google-play-scraper の list() を使い、カテゴリ別ランキングから
 * 対象アプリと競合の順位を取得する。
 *
 * 出力: 各アプリのカテゴリ内順位 + 上位アプリリスト
 * → 因果エンジンの RANKING_SHIFT パターン検出に使用
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import gplay from 'google-play-scraper'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ジャンル名 → Google Play カテゴリIDのマッピング
const GENRE_CATEGORY_MAP = {
  'RPG':            gplay.category.GAME_ROLE_PLAYING,
  '放置RPG':        gplay.category.GAME_ROLE_PLAYING,
  'アクションRPG':  gplay.category.GAME_ROLE_PLAYING,
  'パズルRPG':      gplay.category.GAME_ROLE_PLAYING,
  'アクション':     gplay.category.GAME_ACTION,
  'パズル':         gplay.category.GAME_PUZZLE,
  'ストラテジー':   gplay.category.GAME_STRATEGY,
  'カジュアル':     gplay.category.GAME_CASUAL,
  'シミュレーション': gplay.category.GAME_SIMULATION,
  '育成シミュレーション': gplay.category.GAME_SIMULATION,
}

/**
 * カテゴリランキングを取得し、対象アプリの順位を特定
 *
 * @param {object[]} targets - ドメイン設定の targets 配列
 * @param {object} [options]
 * @param {number} [options.rankingDepth=200] - 何位まで取得するか
 */
export async function fetchStoreRanking(targets, options = {}) {
  if (!targets?.length) return null
  const depth = options.rankingDepth || 200

  // ターゲットからカテゴリを決定 (メインアプリのジャンルを使用)
  const mainTarget = targets.find(t => t.isMain) || targets[0]
  const genre = mainTarget.genre || mainTarget.category || 'RPG'
  const categoryId = GENRE_CATEGORY_MAP[genre] || gplay.category.GAME_ROLE_PLAYING

  const collections = [
    { key: 'top_grossing', collection: gplay.collection.GROSSING, label: '売上トップ' },
    { key: 'top_free', collection: gplay.collection.TOP_FREE, label: '無料トップ' },
  ]

  const results = { rankings: {}, targetPositions: [], fetched_at: new Date().toISOString() }

  for (const col of collections) {
    try {
      console.log(`[ranking] ${col.label} (${genre}) top ${depth}...`)
      const list = await gplay.list({
        category: categoryId,
        collection: col.collection,
        num: depth,
        country: 'jp',
        lang: 'ja',
      })

      // ランキングリスト (上位20件のサマリー)
      results.rankings[col.key] = list.slice(0, 20).map((app, i) => ({
        rank: i + 1,
        appId: app.appId,
        title: app.title,
        developer: app.developer,
        score: app.score,
      }))

      // 対象アプリの順位を検索
      for (const target of targets) {
        const storeId = target.store_id_android || target.identifiers?.store_id_android
        if (!storeId) continue
        const idx = list.findIndex(a => a.appId === storeId)
        if (idx !== -1) {
          results.targetPositions.push({
            id: target.id,
            name: target.name,
            collection: col.key,
            rank: idx + 1,
            totalInList: list.length,
          })
          console.log(`[ranking]   ${target.name}: #${idx + 1} in ${col.label}`)
        }
      }
    } catch (e) {
      console.warn(`[ranking] ${col.label} failed:`, e.message)
    }
  }

  if (Object.keys(results.rankings).length === 0) {
    console.warn('[ranking] no ranking data fetched — returning mock')
    return buildMockRanking(targets)
  }

  return { source: 'Google Play Ranking', genre, ...results }
}

function buildMockRanking(targets) {
  return {
    source: 'Google Play Ranking (mock)',
    genre: 'RPG',
    rankings: { top_grossing: [], top_free: [] },
    targetPositions: targets.map((t, i) => ({
      id: t.id,
      name: t.name,
      collection: 'top_grossing',
      rank: 30 + i * 15,
      totalInList: 200,
    })),
    fetched_at: new Date().toISOString(),
  }
}
