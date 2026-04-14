/**
 * 競合自動探索 & 定期更新モジュール
 *
 * 既存ドメイン設定のメインアプリを起点に、Google Play から
 * ポジション（インストール数・評価・カテゴリ）と方向性（更新頻度・成長傾向）
 * が近い競合を 5〜10 件探索し、ドメイン設定を更新する。
 *
 * 使い方:
 *   node src/collectors/competitor-discovery.js --domain memento-mori
 *   DOMAIN=memento-mori npm run discover:refresh
 *
 * 動作:
 *   1. 既存ドメイン設定を読み込み
 *   2. メインアプリの情報を取得
 *   3. 複数ソースから候補を収集 (similar, search, category)
 *   4. ポジション類似度 × 方向性類似度 でスコアリング
 *   5. 上位 5〜10 件を選定
 *   6. ドメイン設定を更新 (既存の手動追加は保持)
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import gplay from 'google-play-scraper'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CONFIG_DIR = path.resolve(__dirname, '../../config')
const DOMAINS_DIR = path.resolve(CONFIG_DIR, 'domains')

const MIN_COMPETITORS = 5
const MAX_COMPETITORS = 10
const CANDIDATE_FETCH_LIMIT = 30

// ───────────────────────────────────────────────
// スコアリング
// ───────────────────────────────────────────────

/**
 * インストール数の文字列を数値に変換
 * "1,000,000+" → 1000000, "10M+" → 10000000
 */
function parseInstalls(str) {
  if (!str) return 0
  const cleaned = String(str).replace(/[,+\s]/g, '')
  const match = cleaned.match(/^(\d+(?:\.\d+)?)\s*([KMB])?$/i)
  if (!match) return parseInt(cleaned, 10) || 0
  const num = parseFloat(match[1])
  const unit = (match[2] || '').toUpperCase()
  if (unit === 'K') return num * 1_000
  if (unit === 'M') return num * 1_000_000
  if (unit === 'B') return num * 1_000_000_000
  return num
}

/**
 * ポジション類似度 (0〜1)
 * - カテゴリ一致
 * - インストール数の近さ (対数スケール)
 * - レビュースコアの近さ
 */
function calcPositionScore(mainApp, candidate) {
  let score = 0

  // カテゴリ一致 (0.3)
  if (candidate.genreId === mainApp.genreId) {
    score += 0.3
  } else if (candidate.genreId?.split('_')[0] === mainApp.genreId?.split('_')[0]) {
    score += 0.15 // 大カテゴリのみ一致 (GAME_ 系など)
  }

  // インストール数の近さ (0.35) — 対数スケールで比較
  const mainInstalls = parseInstalls(mainApp.installs)
  const candInstalls = parseInstalls(candidate.installs)
  if (mainInstalls > 0 && candInstalls > 0) {
    const logMain = Math.log10(mainInstalls)
    const logCand = Math.log10(candInstalls)
    const diff = Math.abs(logMain - logCand)
    // 差が0なら満点、差が3桁(1000倍)で0
    score += Math.max(0, 0.35 * (1 - diff / 3))
  }

  // レビュースコアの近さ (0.35) — 最大差は3.0 (2.0〜5.0)
  if (mainApp.score && candidate.score) {
    const diff = Math.abs(mainApp.score - candidate.score)
    score += Math.max(0, 0.35 * (1 - diff / 2.0))
  }

  return score
}

/**
 * 方向性類似度 (0〜1)
 * - 最終更新日の近さ（活発さ）
 * - free/paid の一致
 * - レビュー数（アクティブユーザー規模）
 */
function calcDirectionScore(mainApp, candidate) {
  let score = 0

  // 更新日の近さ (0.5) — 両方とも最近更新されているか
  if (mainApp.updated && candidate.updated) {
    const mainDate = new Date(mainApp.updated).getTime()
    const candDate = new Date(candidate.updated).getTime()
    const daysDiff = Math.abs(mainDate - candDate) / (1000 * 60 * 60 * 24)
    // 同日更新なら満点、180日差で0
    score += Math.max(0, 0.5 * (1 - daysDiff / 180))
  } else {
    score += 0.15 // 情報不足の場合は中間値
  }

  // Free/Paid 一致 (0.2)
  if (candidate.free === mainApp.free) {
    score += 0.2
  }

  // レビュー数の近さ (0.3) — アクティブ規模の類似
  const mainRatings = mainApp.ratings || 0
  const candRatings = candidate.ratings || 0
  if (mainRatings > 0 && candRatings > 0) {
    const logMain = Math.log10(mainRatings)
    const logCand = Math.log10(candRatings)
    const diff = Math.abs(logMain - logCand)
    score += Math.max(0, 0.3 * (1 - diff / 3))
  }

  return score
}

/**
 * 総合スコア (ポジション 60% + 方向性 40%)
 */
function calcTotalScore(mainApp, candidate) {
  const position = calcPositionScore(mainApp, candidate)
  const direction = calcDirectionScore(mainApp, candidate)
  return {
    total: position * 0.6 + direction * 0.4,
    position,
    direction,
  }
}

// ───────────────────────────────────────────────
// Google Play データ取得
// ───────────────────────────────────────────────

async function fetchAppInfo(appId) {
  const info = await gplay.app({ appId, lang: 'ja', country: 'jp' })
  return {
    appId: info.appId,
    title: info.title,
    developer: info.developer,
    developerId: info.developerId,
    genre: info.genre,
    genreId: info.genreId,
    score: info.score,
    ratings: info.ratings,
    installs: info.installs,
    free: info.free,
    updated: info.updated,
    description: info.summary?.slice(0, 300) || '',
  }
}

/**
 * 複数ソースから競合候補を収集
 */
async function fetchCandidates(mainApp) {
  const candidates = new Map() // appId → app info

  // ソース 1: Google Play の「類似アプリ」
  console.log('  [1/3] 類似アプリを取得...')
  try {
    const similar = await gplay.similar({
      appId: mainApp.appId, lang: 'ja', country: 'jp',
    })
    for (const app of similar.slice(0, CANDIDATE_FETCH_LIMIT)) {
      if (app.appId !== mainApp.appId) {
        candidates.set(app.appId, {
          appId: app.appId,
          title: app.title,
          developer: app.developer,
          genre: app.genre,
          genreId: app.genreId,
          score: app.score,
          ratings: app.ratings,
          installs: app.installs,
          free: app.free,
          updated: app.updated,
          source: 'similar',
        })
      }
    }
    console.log(`    → ${candidates.size} 件`)
  } catch (e) {
    console.warn(`    × 類似アプリ取得失敗: ${e.message}`)
  }

  // ソース 2: キーワード検索 (アプリ名のジャンル)
  console.log('  [2/3] キーワード検索...')
  try {
    const searchTerms = [mainApp.genre, mainApp.genreId?.replace('GAME_', '').replace('_', ' ')].filter(Boolean)
    for (const term of searchTerms.slice(0, 2)) {
      const results = await gplay.search({
        term, lang: 'ja', country: 'jp', num: 20,
      })
      for (const app of results) {
        if (app.appId !== mainApp.appId && !candidates.has(app.appId)) {
          candidates.set(app.appId, {
            appId: app.appId,
            title: app.title,
            developer: app.developer,
            genre: app.genre,
            genreId: app.genreId,
            score: app.score,
            ratings: app.ratings,
            installs: app.installs,
            free: app.free,
            updated: app.updated,
            source: 'search',
          })
        }
      }
    }
    console.log(`    → 累計 ${candidates.size} 件`)
  } catch (e) {
    console.warn(`    × 検索失敗: ${e.message}`)
  }

  // ソース 3: 同開発者の他アプリ (比較用)
  console.log('  [3/3] 同開発者アプリ...')
  try {
    const devApps = await gplay.developer({
      devId: mainApp.developerId, lang: 'ja', country: 'jp',
    })
    for (const app of devApps) {
      if (app.appId !== mainApp.appId && !candidates.has(app.appId)) {
        candidates.set(app.appId, {
          appId: app.appId,
          title: app.title,
          developer: app.developer,
          genre: app.genre,
          genreId: app.genreId,
          score: app.score,
          ratings: app.ratings,
          installs: app.installs,
          free: app.free,
          updated: app.updated,
          source: 'developer',
        })
      }
    }
    console.log(`    → 累計 ${candidates.size} 件`)
  } catch (e) {
    console.warn(`    × 開発者アプリ取得失敗: ${e.message}`)
  }

  return [...candidates.values()]
}

/**
 * 候補をスコアリングし、上位を選定
 */
function rankCandidates(mainApp, candidates) {
  const scored = candidates.map(c => ({
    ...c,
    scores: calcTotalScore(mainApp, c),
  }))

  scored.sort((a, b) => b.scores.total - a.scores.total)

  return scored
}

// ───────────────────────────────────────────────
// ドメイン設定の更新
// ───────────────────────────────────────────────

/**
 * 既存ドメイン設定を読み込む
 */
function loadDomainConfig(domainName) {
  const domainPath = path.join(DOMAINS_DIR, `${domainName}.json`)
  if (!fs.existsSync(domainPath)) {
    throw new Error(`ドメイン設定が見つからない: ${domainPath}`)
  }
  return JSON.parse(fs.readFileSync(domainPath, 'utf8'))
}

/**
 * ドメイン設定の競合ターゲットを更新
 */
function updateDomainConfig(domainConfig, mainApp, rankedCandidates) {
  const now = new Date().toISOString().slice(0, 10)

  // 手動追加 (pinned) されたターゲットは保持
  const existingTargets = domainConfig.targets || []
  const pinnedTargets = existingTargets.filter(t => t.pinned)
  const mainTarget = existingTargets.find(t => t.isMain)

  // 選定数 = MAX - pinned数 (最低 MIN は確保)
  const autoSlots = Math.max(MIN_COMPETITORS, MAX_COMPETITORS - pinnedTargets.length)
  const selected = rankedCandidates.slice(0, autoSlots)

  // 新しい targets 配列を構築
  const newTargets = [
    // メインは維持
    mainTarget || {
      id: domainConfig.domain,
      name: mainApp.title,
      category: mainApp.genre,
      isMain: true,
      identifiers: { store_id_android: mainApp.appId },
    },
    // pinned (手動追加)
    ...pinnedTargets,
    // 自動探索で選定された競合
    ...selected.map(c => ({
      id: c.appId.split('.').pop() || c.appId.replace(/\./g, '-'),
      name: c.title,
      category: c.genre || mainApp.genre,
      isMain: false,
      identifiers: { store_id_android: c.appId },
      discovery: {
        source: c.source,
        similarityScore: Math.round(c.scores.total * 100) / 100,
        positionScore: Math.round(c.scores.position * 100) / 100,
        directionScore: Math.round(c.scores.direction * 100) / 100,
        discoveredAt: now,
        lastSeen: now,
      },
    })),
  ]

  // 開発者リストを更新
  const developers = [...new Set(
    newTargets
      .map(t => selected.find(c => c.appId === t.identifiers?.store_id_android)?.developer)
      .filter(Boolean)
  )]

  // Google Trends キーワード更新 (メイン + 上位4競合 = 最大5)
  const trendKeywords = [
    mainApp.title,
    ...selected.slice(0, 4).map(c => c.title),
  ].slice(0, 5)

  // 設定を更新
  const updated = { ...domainConfig }
  updated.targets = newTargets
  updated.competitors = developers
  updated.discovery = {
    lastRun: now,
    candidatesEvaluated: rankedCandidates.length,
    autoSelected: selected.length,
    pinnedCount: pinnedTargets.length,
    minScore: selected.length > 0
      ? Math.round(selected[selected.length - 1].scores.total * 100) / 100
      : 0,
  }

  // Trends キーワードを更新
  if (updated.layers?.macro?.sources?.['google-trends']) {
    updated.layers.macro.sources['google-trends'].keywords = trendKeywords
  }

  return { config: updated, selected, dropped: [] }
}

// ───────────────────────────────────────────────
// メインフロー
// ───────────────────────────────────────────────

export async function refreshCompetitors(domainName, options = {}) {
  console.log(`\n=== 競合自動探索: domain "${domainName}" ===\n`)

  // 1. 既存設定を読み込み
  const domainConfig = loadDomainConfig(domainName)
  const mainTarget = domainConfig.targets.find(t => t.isMain)
  if (!mainTarget) {
    throw new Error('メインターゲットが見つからない (isMain: true)')
  }

  const mainAppId = mainTarget.identifiers?.store_id_android
  if (!mainAppId) {
    throw new Error('メインターゲットに store_id_android がない')
  }

  // 2. メインアプリの最新情報を取得
  console.log('[1/4] メインアプリ情報を取得...')
  const mainApp = await fetchAppInfo(mainAppId)
  console.log(`  ${mainApp.title} (${mainApp.developer})`)
  console.log(`  ジャンル: ${mainApp.genre} | ★${mainApp.score} | ${mainApp.installs} installs`)

  // 3. 候補を収集
  console.log('\n[2/4] 競合候補を収集...')
  const candidates = await fetchCandidates(mainApp)
  console.log(`  合計 ${candidates.length} 件の候補`)

  // 4. スコアリング & 選定
  console.log('\n[3/4] スコアリング...')
  const ranked = rankCandidates(mainApp, candidates)

  // 上位を表示
  console.log('\n  ── スコア上位 ──')
  for (const c of ranked.slice(0, 15)) {
    const mark = c.scores.total >= 0.4 ? '✓' : ' '
    console.log(
      `  ${mark} ${c.title.padEnd(25)} ` +
      `総合=${c.scores.total.toFixed(2)} ` +
      `(位置=${c.scores.position.toFixed(2)} 方向=${c.scores.direction.toFixed(2)}) ` +
      `[${c.source}]`
    )
  }

  // 5. ドメイン設定を更新
  console.log('\n[4/4] ドメイン設定を更新...')
  const { config: updatedConfig, selected } = updateDomainConfig(domainConfig, mainApp, ranked)

  // 6. ファイル出力
  const domainPath = path.join(DOMAINS_DIR, `${domainName}.json`)
  fs.writeFileSync(domainPath, JSON.stringify(updatedConfig, null, 2))
  console.log(`  保存: ${domainPath}`)

  // targets.json も更新
  const targetsJson = {
    titles: updatedConfig.targets.map(t => ({
      id: t.id,
      name: t.name,
      genre: t.category,
      store_id_android: t.identifiers?.store_id_android,
      ...(t.identifiers?.store_id_ios ? { store_id_ios: t.identifiers.store_id_ios } : {}),
    })),
    genres: updatedConfig.categories || [],
    competitors: updatedConfig.competitors || [],
    google_trends: updatedConfig.layers?.macro?.sources?.['google-trends'] || { keywords: [], geo: 'JP' },
  }
  const targetsPath = path.join(CONFIG_DIR, 'targets.json')
  fs.writeFileSync(targetsPath, JSON.stringify(targetsJson, null, 2))
  console.log(`  保存: ${targetsPath}`)

  // サマリー
  console.log(`\n=== 完了 ===`)
  console.log(`  メイン: ${mainApp.title}`)
  console.log(`  競合: ${selected.length} 件 (候補 ${candidates.length} 件から選定)`)
  console.log(`  pinned: ${updatedConfig.discovery.pinnedCount} 件`)
  console.log(`  最低スコア: ${updatedConfig.discovery.minScore}`)
  console.log(`\n収集実行: DOMAIN=${domainName} npm run collect`)

  return updatedConfig
}

// CLI 実行
const isDirectRun = process.argv[1]?.includes('competitor-discovery')
if (isDirectRun) {
  const domainArg = process.argv.indexOf('--domain')
  const domainName = (domainArg !== -1 ? process.argv[domainArg + 1] : process.env.DOMAIN || '').trim()

  if (!domainName) {
    console.error('Usage: node src/collectors/competitor-discovery.js --domain <name>')
    console.error('Example: node src/collectors/competitor-discovery.js --domain memento-mori')
    console.error('\nまたは環境変数: DOMAIN=memento-mori npm run discover:refresh')
    process.exit(1)
  }

  refreshCompetitors(domainName).catch(e => {
    console.error('[FATAL]', e.message)
    process.exit(1)
  })
}
