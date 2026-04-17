/**
 * データ収集エントリーポイント
 *
 * ドメインフレームワーク対応:
 *   DOMAIN=memento-mori npm run collect
 *   DOMAIN=game-market npm run collect (デフォルト)
 *
 * 6コレクター体制:
 *   1. Google Trends   — 検索トレンド推移 (マクロ)
 *   2. Store Reviews   — レビュー・評価・ヒストグラム・What's New (ユーザー+アクション)
 *   3. Store Ranking   — カテゴリ別順位 (競合ポジション)
 *   4. Community        — Reddit コミュニティ活動 (先行指標)
 *   5. News RSS        — 業界ニュース (マクロ)
 *
 * ドメイン設定 (config/domains/{domain}.json) から
 * targets / sources / keywords を自動解決する。
 */

import { fetchTrends } from './trends.js'
import { fetchStoreReviews } from './store.js'
import { fetchStoreRanking } from './store-ranking.js'
import { fetchCommunity } from './community.js'
import { fetchNews } from './news.js'
import { fetchYouTubeChannels } from './youtube-channels.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.resolve(__dirname, '../../data')
const PUBLIC_DATA_DIR = path.resolve(__dirname, '../../public/data')
const CONFIG_DIR = path.resolve(__dirname, '../../config')
const DOMAINS_DIR = path.resolve(CONFIG_DIR, 'domains')
const HISTORY_DIR = path.resolve(DATA_DIR, 'history')

function saveJson(filepath, data) {
  fs.mkdirSync(path.dirname(filepath), { recursive: true })
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2))
}

/** YYYY-MM-DD から、その日が属する週の月曜日の YYYY-MM-DD を返す (UTC基準) */
function weekStartDate(isoDate) {
  const d = new Date(`${isoDate}T00:00:00Z`)
  const day = d.getUTCDay() // 0=Sun, 1=Mon, ... 6=Sat
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().slice(0, 10)
}

/**
 * ドメイン設定を読み込み、各コレクター用のパラメータを構築
 */
function loadDomainConfig(domainName) {
  const domainPath = path.join(DOMAINS_DIR, `${domainName}.json`)
  if (!fs.existsSync(domainPath)) {
    throw new Error(`ドメイン設定が見つからない: ${domainPath}`)
  }
  const domain = JSON.parse(fs.readFileSync(domainPath, 'utf8'))

  const config = {
    titles: domain.targets.map(t => ({
      id: t.id,
      name: t.name,
      genre: t.category,
      store_id_android: t.identifiers?.store_id_android,
      store_id_ios: t.identifiers?.store_id_ios,
      isMain: t.isMain || false,
    })),
    // identifiers をそのまま保持した対象 (YouTube 等の collector が使う)
    rawTargets: domain.targets,
    genres: domain.categories || [],
    competitors: domain.competitors || [],
    google_trends: domain.layers?.macro?.sources?.['google-trends'] || { keywords: [], geo: 'JP' },
    news_rss: domain.layers?.macro?.sources?.['news-rss'] || { feeds: [] },
    community: domain.layers?.user?.sources?.community || {},
    youtube_channels: domain.layers?.competitor?.sources?.['youtube-channels'] || null,
  }

  return { domain, config }
}

async function run() {
  // --domain 引数 > 環境変数 DOMAIN > デフォルト game-market
  const domainArg = process.argv.indexOf('--domain')
  const domainName = (domainArg !== -1 ? process.argv[domainArg + 1] : process.env.DOMAIN || 'game-market').trim()
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

  // YouTube コレクターは対象に youtube_channel_id があるかドメイン設定がある場合のみ走らせる
  const runYoutube = Boolean(
    config.youtube_channels
    || (config.rawTargets || []).some(t => t?.identifiers?.youtube_channel_id)
  )
  const totalCollectors = 5 + (runYoutube ? 1 : 0)

  // 1. Google Trends
  console.log(`\n[1/${totalCollectors}] Google Trends...`)
  try {
    results.trends = await fetchTrends(config.google_trends)
    saveJson(path.join(DATA_DIR, `trends_${today}.json`), results.trends)
    console.log(`  OK: ${results.trends?.weekly?.length ?? 0} data points`)
  } catch (e) {
    console.error(`  FAIL: ${e.message}`)
    errors.push({ collector: 'trends', error: e.message })
    results.trends = null
  }

  // 2. Store Reviews + Detail (ヒストグラム, What's New, バージョン)
  console.log(`\n[2/${totalCollectors}] Store Reviews & Detail (Google Play)...`)
  try {
    results.reviews = await fetchStoreReviews(config.titles)
    saveJson(path.join(DATA_DIR, `store-reviews_${today}.json`), results.reviews)
    console.log(`  OK: ${results.reviews?.apps?.length ?? 0} apps`)
  } catch (e) {
    console.error(`  FAIL: ${e.message}`)
    errors.push({ collector: 'store', error: e.message })
    results.reviews = null
  }

  // 3. Store Ranking (カテゴリ別順位)
  console.log(`\n[3/${totalCollectors}] Store Ranking...`)
  try {
    results.ranking = await fetchStoreRanking(config.titles)
    saveJson(path.join(DATA_DIR, `store-ranking_${today}.json`), results.ranking)
    const positions = results.ranking?.targetPositions?.length ?? 0
    console.log(`  OK: ${positions} targets ranked`)
  } catch (e) {
    console.error(`  FAIL: ${e.message}`)
    errors.push({ collector: 'ranking', error: e.message })
    results.ranking = null
  }

  // 4. Community (Reddit)
  console.log(`\n[4/${totalCollectors}] Community (Reddit)...`)
  try {
    // ドメイン設定に英語キーワードがあればそちらを優先 (Redditは英語圏)
    const communityKeywords = config.community?.keywords
      || config.titles.filter(t => t.isMain).map(t => t.name)
    if (communityKeywords.length === 0) communityKeywords.push(config.titles[0]?.name)
    const subreddits = config.community?.subreddits || []
    results.community = await fetchCommunity(communityKeywords, { subreddits })
    saveJson(path.join(DATA_DIR, `community_${today}.json`), results.community)
    console.log(`  OK: ${results.community?.stats?.totalPosts ?? 0} posts`)
  } catch (e) {
    console.error(`  FAIL: ${e.message}`)
    errors.push({ collector: 'community', error: e.message })
    results.community = null
  }

  // 5. News RSS
  console.log(`\n[5/${totalCollectors}] News RSS...`)
  try {
    results.news = await fetchNews(config.news_rss?.feeds)
    saveJson(path.join(DATA_DIR, `news_${today}.json`), results.news)
    console.log(`  OK: ${results.news?.length ?? 0} articles`)
  } catch (e) {
    console.error(`  FAIL: ${e.message}`)
    errors.push({ collector: 'news', error: e.message })
    results.news = null
  }

  // 6. YouTube Channels (インフルエンサー L2: 対象に youtube_channel_id がある場合のみ)
  if (runYoutube) {
    console.log(`\n[6/${totalCollectors}] YouTube Channels...`)
    try {
      results.youtubeChannels = await fetchYouTubeChannels({
        sources: config.youtube_channels,
        targets: config.rawTargets,
      })
      saveJson(path.join(DATA_DIR, `youtube-channels_${today}.json`), results.youtubeChannels)
      console.log(`  OK: ${results.youtubeChannels?.channels?.length ?? 0} channels`)
    } catch (e) {
      console.error(`  FAIL: ${e.message}`)
      errors.push({ collector: 'youtube-channels', error: e.message })
      results.youtubeChannels = null
    }
  }

  // 履歴蓄積: 過去データとマージして推移を追跡できるようにする
  console.log('\n[history] merging with historical data...')
  const merged = mergeWithHistory(domainName, today, results)

  // ダッシュボード用に統合ファイルを出力
  fs.mkdirSync(PUBLIC_DATA_DIR, { recursive: true })
  saveJson(path.join(PUBLIC_DATA_DIR, 'collected.json'), merged)
  console.log('  public/data/collected.json saved')

  // サマリー
  const succeeded = totalCollectors - errors.length
  console.log(`\n=== Done: ${succeeded}/${totalCollectors} collectors succeeded (${domainName}) ===`)
  if (errors.length > 0) {
    console.log('Failures:')
    for (const err of errors) {
      console.log(`  - ${err.collector}: ${err.error}`)
    }
  }
}

/**
 * 過去の履歴データとマージし、推移を追跡可能にする
 *
 * - reviews: 月次スナップショットを蓄積 (最大12ヶ月)
 * - trends: 週次データを蓄積 (最大26週)
 * - ranking: 日次スナップショットを蓄積 (最大90日)
 * - community: 日次統計を蓄積 (最大30日)
 */
function mergeWithHistory(domainName, today, results) {
  fs.mkdirSync(HISTORY_DIR, { recursive: true })
  const historyPath = path.join(HISTORY_DIR, `${domainName}.json`)

  let history = { reviews: {}, reviewTexts: {}, trends: [], ranking: [], community: [], youtubeChannels: {} }
  if (fs.existsSync(historyPath)) {
    try {
      history = JSON.parse(fs.readFileSync(historyPath, 'utf8'))
      // 後方互換: 既存履歴に reviewTexts が無ければ空で初期化
      if (!history.reviewTexts) history.reviewTexts = {}
      if (!history.youtubeChannels) history.youtubeChannels = {}
    } catch (e) {
      console.warn('[history] failed to read history, starting fresh:', e.message)
    }
  }

  const month = today.slice(0, 7) // YYYY-MM

  // === Reviews 履歴蓄積 (月次) ===
  if (results.reviews?.apps?.length) {
    for (const app of results.reviews.apps) {
      if (!history.reviews[app.id]) history.reviews[app.id] = {}
      history.reviews[app.id][month] = {
        score: app.appInfo?.score ?? null,
        ratings: app.appInfo?.ratings ?? null,
        reviews: app.appInfo?.reviews ?? null,
        histogram: app.appInfo?.histogram ?? null,
        reviewVelocity: app.reviewVelocity ?? null,
        version: app.appInfo?.version ?? null,
        recentChanges: app.appInfo?.recentChanges ?? null,
      }
    }

    // reviews に monthly 履歴を注入
    for (const app of results.reviews.apps) {
      const appHistory = history.reviews[app.id]
      if (appHistory) {
        app.monthlyHistory = Object.entries(appHistory)
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(-12) // 最大12ヶ月
          .map(([m, data]) => ({ month: m, ...data }))
      }
    }

    // === Review Texts 履歴蓄積 (個別レビュー本文を ID で重複除去して保持) ===
    // L3 (ユーザー) の本丸データ。何が起きたかを時系列で振り返れる
    // 1アプリあたり最大 1000 件、日付降順で保持
    const REVIEW_TEXTS_LIMIT = 1000
    const capturedAt = new Date().toISOString()
    for (const app of results.reviews.apps) {
      if (!Array.isArray(app.recentReviews) || app.recentReviews.length === 0) continue
      const existing = history.reviewTexts[app.id] || []
      const byId = new Map(existing.map(r => [r.id, r]))

      for (const r of app.recentReviews) {
        if (!r.id) continue
        if (byId.has(r.id)) continue // 既存はそのまま (capturedAt を保持)
        byId.set(r.id, {
          id: r.id,
          score: r.score ?? null,
          text: r.text || '',
          date: typeof r.date === 'string' ? r.date : r.date?.toISOString?.() || null,
          thumbsUp: r.thumbsUp ?? 0,
          appVersion: app.appInfo?.version || null,
          capturedAt,
        })
      }

      // 日付降順 (新しい順) でソートして上限まで保持
      const sorted = Array.from(byId.values()).sort((a, b) => {
        const da = a.date || ''
        const db = b.date || ''
        return db.localeCompare(da)
      })
      history.reviewTexts[app.id] = sorted.slice(0, REVIEW_TEXTS_LIMIT)

      // results 側にも蓄積済みレビューを注入 (ダッシュボードで時系列分析に使う)
      app.reviewTextsHistory = history.reviewTexts[app.id]
    }
  }

  // === Trends 履歴蓄積 (週次: 最新フェッチを優先してマージ) ===
  // Google Trends は取得期間ごとに相対的に再正規化されるため、
  // 今回のフェッチに含まれる週 (直近3ヶ月) は新しい値で上書きし、
  // それより古い週だけ履歴から引き継ぐことで、直近ウィンドウを
  // 単一スケールに揃える。
  if (!Array.isArray(history.trends)) history.trends = []
  if (results.trends?.weekly?.length) {
    const newByDate = new Map(results.trends.weekly.map(w => [w.date, w]))
    const merged = []
    for (const w of history.trends) {
      if (!newByDate.has(w.date)) merged.push(w)
    }
    for (const w of results.trends.weekly) merged.push(w)
    merged.sort((a, b) => a.date.localeCompare(b.date))
    // 最大52週保持
    history.trends = merged.slice(-52)
  }
  // 今回フェッチが失敗/空でも、蓄積済み履歴を results に反映して
  // ダッシュボードが過去の推移を表示できるようにする
  if (history.trends.length > 0) {
    if (!results.trends) {
      results.trends = { source: 'Google Trends (history)', weekly: [] }
    }
    results.trends.weekly = history.trends
  }

  // === Ranking 履歴蓄積 (日次スナップショット: 同日は最新で上書き) ===
  if (!Array.isArray(history.ranking)) history.ranking = []
  if (results.ranking?.targetPositions?.length) {
    // 同日に再走した場合は最新のスナップショットを採用 (prefer-latest)
    history.ranking = history.ranking.filter(r => r.date !== today)
    history.ranking.push({
      date: today,
      positions: results.ranking.targetPositions,
    })
    history.ranking.sort((a, b) => a.date.localeCompare(b.date))
    history.ranking = history.ranking.slice(-90) // 最大90日保持
  }
  // フェッチ失敗/空でも蓄積履歴を results に反映
  if (history.ranking.length > 0) {
    if (!results.ranking) {
      results.ranking = { source: 'Store Ranking (history)', targetPositions: [] }
    }
    results.ranking.history = history.ranking
  }

  // === Community 履歴蓄積 (日次統計: 同日は最新で上書き) ===
  if (!Array.isArray(history.community)) history.community = []
  if (results.community?.stats) {
    history.community = history.community.filter(r => r.date !== today)
    history.community.push({
      date: today,
      stats: results.community.stats,
    })
    history.community.sort((a, b) => a.date.localeCompare(b.date))
    history.community = history.community.slice(-30) // 最大30日保持
  }
  // フェッチ失敗/空でも蓄積履歴を results に反映
  if (history.community.length > 0) {
    if (!results.community) {
      results.community = { source: 'Community (history)', stats: null }
    }
    results.community.history = history.community
  }

  // === YouTube Channels 履歴蓄積 (週次: 同週は最新で上書き, 最大26週保持) ===
  // 週キーは ISO 週ではなく「その日が属する月曜起点の日付 YYYY-MM-DD」。
  // subscribers/total_views/video_count は累積値のため週次の差分から成長率を算出できる。
  if (!history.youtubeChannels || typeof history.youtubeChannels !== 'object') {
    history.youtubeChannels = {}
  }
  if (results.youtubeChannels?.channels?.length) {
    const weekKey = weekStartDate(today)
    for (const ch of results.youtubeChannels.channels) {
      if (!ch.id || ch.error) continue
      if (!history.youtubeChannels[ch.id]) history.youtubeChannels[ch.id] = []
      const weekly = history.youtubeChannels[ch.id].filter(w => w.week !== weekKey)
      weekly.push({
        week: weekKey,
        subscribers: ch.subscribers ?? null,
        total_views: ch.total_views ?? null,
        video_count: ch.video_count ?? null,
        posts_30d: ch.posts_30d ?? null,
        total_views_30d: ch.total_views_30d ?? null,
        avg_views_30d: ch.avg_views_30d ?? null,
        engagement_rate_30d: ch.engagement_rate_30d ?? null,
      })
      weekly.sort((a, b) => a.week.localeCompare(b.week))
      history.youtubeChannels[ch.id] = weekly.slice(-26)
    }
    // results にも履歴を注入 (ダッシュボードで推移表示)
    for (const ch of results.youtubeChannels.channels) {
      if (ch.id && history.youtubeChannels[ch.id]) {
        ch.weeklyHistory = history.youtubeChannels[ch.id]
      }
    }
  }
  // フェッチ失敗/空でも蓄積履歴を results に反映
  const ytHistoryCount = Object.values(history.youtubeChannels).reduce((s, arr) => s + (arr?.length || 0), 0)
  if (ytHistoryCount > 0 && !results.youtubeChannels) {
    results.youtubeChannels = {
      source: 'YouTube Channels (history)',
      channels: Object.entries(history.youtubeChannels).map(([id, weekly]) => ({
        id,
        weeklyHistory: weekly,
      })),
    }
  }

  // 履歴を保存
  saveJson(historyPath, history)
  const reviewMonths = Object.values(history.reviews).reduce((max, h) => Math.max(max, Object.keys(h).length), 0)
  const reviewTextsTotal = Object.values(history.reviewTexts || {}).reduce((sum, arr) => sum + arr.length, 0)
  const ytChannels = Object.keys(history.youtubeChannels).length
  const ytWeeks = Object.values(history.youtubeChannels).reduce((max, arr) => Math.max(max, arr.length), 0)
  console.log(`[history] saved: ${history.trends.length} trend weeks, ${reviewMonths} review months, ${reviewTextsTotal} review texts, ${history.ranking.length} ranking days, ${history.community.length} community days, ${ytChannels} yt channels (${ytWeeks} wk max)`)

  return results
}

run().catch(e => {
  console.error('[FATAL] Collector crashed:', e.message)
  process.exit(1)
})
