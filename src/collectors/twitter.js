/**
 * Twitter/X ツイート検索コレクター (via Nitter RSS)
 *
 * 背景:
 *   X の公式 API は有料 (Basic $100/mo, Pro $5000/mo) で個人利用には重い。
 *   一方 Reddit は英語圏のバズしか拾えず、日本語ゲームの会話は X が中心。
 *   → Nitter の RSS (/search/rss?f=tweets&q=...) で公開 API なしで検索結果を取得する。
 *
 * 特徴:
 *   - 複数の Nitter インスタンスを順に試行し、429/5xx/タイムアウトは次へフェイルオーバー
 *   - 取得件数 / 著者ユニーク数 / 平均本文長 / 日別件数 を集計 (L3 ユーザー層)
 *   - `NITTER_DISABLE=1` で無効化 (CI 等)
 *   - 取得ゼロ時はモックにフォールバック (ダッシュボード空表示を避ける)
 *
 * 注意:
 *   Nitter は正規の X API ではなく非公式なミラー。運営者が停止する可能性あり。
 *   本来は X API / snscrape / 有償データソースへの切替を想定した薄いラッパ。
 */

import RSSParser from 'rss-parser'

const DEFAULT_INSTANCES = [
  'https://nitter.net',
  'https://nitter.privacydev.net',
  'https://nitter.poast.org',
  'https://nitter.space',
]

const USER_AGENT = 'market-intel-app/1.0 (+twitter via nitter)'
const PER_QUERY_TIMEOUT = 12000

/**
 * キーワード配列から X のツイートを検索
 *
 * @param {string[]} keywords - 検索キーワード
 * @param {object} [options]
 * @param {string[]} [options.instances] - Nitter インスタンスURL配列
 * @param {string} [options.lang] - 言語フィルタ ('ja' 等、未指定で全言語)
 * @param {number} [options.perKeyword] - 1キーワードあたり取得上限 (デフォルト 25)
 * @returns {Promise<object|null>}
 */
export async function fetchTwitter(keywords, options = {}) {
  if (process.env.NITTER_DISABLE === '1') {
    console.log('[twitter] NITTER_DISABLE=1 — skipping real fetch')
    return buildMockTwitter(keywords)
  }
  if (!keywords?.length) return null

  const instances = options.instances || DEFAULT_INSTANCES
  const lang = options.lang
  const perKeyword = options.perKeyword || 25
  const parser = new RSSParser({
    timeout: PER_QUERY_TIMEOUT,
    headers: { 'User-Agent': USER_AGENT },
  })

  const allTweets = []
  const instanceOrder = shuffle([...instances])

  for (const keyword of keywords) {
    const tweets = await tryFetchOnAnyInstance({
      keyword, lang, parser, instances: instanceOrder, perKeyword,
    })
    if (tweets.length === 0) {
      console.warn(`[twitter] "${keyword}": no tweets from any nitter instance`)
      continue
    }
    console.log(`[twitter] "${keyword}": ${tweets.length} tweets`)
    allTweets.push(...tweets.map(t => ({ ...t, keyword })))
  }

  if (allTweets.length === 0) {
    console.warn('[twitter] all instances failed — returning mock')
    return buildMockTwitter(keywords)
  }

  // ID 重複除去 (同一ツイートを複数キーワードで拾った場合)
  const byId = new Map()
  for (const t of allTweets) {
    if (!t.id) continue
    if (!byId.has(t.id)) byId.set(t.id, t)
  }
  const unique = [...byId.values()].sort((a, b) => {
    const da = a.pubDate ? new Date(a.pubDate).getTime() : 0
    const db = b.pubDate ? new Date(b.pubDate).getTime() : 0
    return db - da
  })

  const stats = calcTwitterStats(unique)

  return {
    source: 'Twitter/X (via Nitter)',
    fetched_at: new Date().toISOString(),
    tweets: unique.slice(0, 100),
    stats,
  }
}

/** 最初に成功した instance からツイートを返す */
async function tryFetchOnAnyInstance({ keyword, lang, parser, instances, perKeyword }) {
  const q = lang ? `${keyword} lang:${lang}` : keyword
  const qs = `f=tweets&q=${encodeURIComponent(q)}`
  for (const base of instances) {
    const url = `${base.replace(/\/$/, '')}/search/rss?${qs}`
    try {
      const feed = await parser.parseURL(url)
      const items = (feed.items || []).slice(0, perKeyword).map(toTweet).filter(Boolean)
      if (items.length > 0) return items
      // 0件でも instance は応答した → 他キーワードで再利用できるのでbreak
      return []
    } catch (e) {
      console.warn(`[twitter] ${base} failed for "${keyword}": ${e.message}`)
    }
  }
  return []
}

function toTweet(item) {
  if (!item?.link) return null
  // Nitter の link は https://nitter.net/<author>/status/<id>
  const m = /\/([^/]+)\/status\/(\d+)/.exec(item.link)
  const author = m?.[1] || null
  const id = m?.[2] || item.guid || null
  const text = stripHtml(item.contentSnippet || item.content || item.title || '')
  return {
    id,
    author,
    text: text.slice(0, 400),
    pubDate: item.pubDate ?? item.isoDate ?? null,
    link: item.link,
  }
}

function stripHtml(s) {
  return String(s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** 日別バケット / 著者ユニーク数 / 本文平均長を集計 */
function calcTwitterStats(tweets) {
  if (!tweets.length) return { totalTweets: 0 }

  const authors = new Set()
  const dayBuckets = new Map() // YYYY-MM-DD -> count
  let textLenSum = 0

  for (const t of tweets) {
    if (t.author) authors.add(t.author.toLowerCase())
    if (t.text) textLenSum += t.text.length
    if (t.pubDate) {
      const d = new Date(t.pubDate)
      if (!isNaN(d)) {
        const key = d.toISOString().slice(0, 10)
        dayBuckets.set(key, (dayBuckets.get(key) || 0) + 1)
      }
    }
  }

  const daily = [...dayBuckets.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))

  let tweetsPerDay = 0
  if (daily.length >= 1) {
    const span = Math.max(daily.length, 1)
    const total = daily.reduce((s, d) => s + d.count, 0)
    tweetsPerDay = Math.round((total / span) * 10) / 10
  }

  return {
    totalTweets: tweets.length,
    uniqueAuthors: authors.size,
    tweetsPerDay,
    avgTextLength: Math.round(textLenSum / tweets.length),
    daily,
  }
}

function buildMockTwitter(keywords) {
  const now = new Date()
  const tweets = (keywords || []).slice(0, 3).flatMap((kw, ki) =>
    Array.from({ length: 4 }).map((_, i) => ({
      id: `mock-${ki}-${i}`,
      author: `user_${ki}${i}`,
      text: `${kw} についての感想ツイート (mock ${i + 1})`,
      pubDate: new Date(now.getTime() - (i * 6 + ki) * 3600 * 1000).toISOString(),
      link: null,
      keyword: kw,
    }))
  )
  return {
    source: 'Twitter/X (mock)',
    fetched_at: now.toISOString(),
    tweets,
    stats: calcTwitterStats(tweets),
  }
}

// CLI 実行
if (process.argv[1] && process.argv[1].endsWith('twitter.js')) {
  const kws = process.argv.slice(2)
  fetchTwitter(kws.length ? kws : ['メメントモリ']).then(r => {
    console.log(JSON.stringify(r, null, 2))
  })
}
