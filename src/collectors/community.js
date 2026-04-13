/**
 * コミュニティ活動コレクター
 *
 * Reddit の公開 JSON API を使い、対象アプリに関するコミュニティ活動を収集。
 * APIキー不要（公開エンドポイント）。
 *
 * 収集項目:
 *   - 対象キーワードの最新投稿 (タイトル, スコア, コメント数)
 *   - 投稿頻度 (1日あたりの投稿数)
 *   - エンゲージメント指標 (平均スコア, 平均コメント数)
 *
 * → 因果エンジンの COMMUNITY_BUZZ パターン検出に使用
 *   コミュニティの盛り上がりはアプリ更新・イベントの先行/遅行指標
 */

const REDDIT_BASE = 'https://www.reddit.com'
const USER_AGENT = 'market-intel-app/1.0 (data collection)'

/**
 * Reddit 検索でキーワード関連の投稿を収集
 *
 * @param {string[]} keywords - 検索キーワード (アプリ名など)
 * @param {object} [options]
 * @param {string[]} [options.subreddits] - 特定のサブレディットに絞る
 * @param {number} [options.limit] - 1キーワードあたりの取得件数
 */
export async function fetchCommunity(keywords, options = {}) {
  if (!keywords?.length) return null
  const limit = options.limit || 25
  const subreddits = options.subreddits || []

  const allPosts = []

  for (const keyword of keywords) {
    try {
      // サブレディット指定がある場合はそこを検索、なければ全体検索
      const posts = subreddits.length > 0
        ? await searchSubreddits(keyword, subreddits, limit)
        : await searchReddit(keyword, limit)

      allPosts.push(...posts.map(p => ({ ...p, keyword })))
      console.log(`[community] "${keyword}": ${posts.length} posts`)
    } catch (e) {
      console.warn(`[community] "${keyword}" failed:`, e.message)
    }
  }

  if (allPosts.length === 0) {
    console.warn('[community] no posts fetched — returning mock')
    return buildMockCommunity(keywords)
  }

  // 集計
  const stats = calcCommunityStats(allPosts)

  return {
    source: 'Reddit',
    fetched_at: new Date().toISOString(),
    posts: allPosts.slice(0, 50), // 最新50件に制限
    stats,
  }
}

async function searchReddit(query, limit) {
  const url = `${REDDIT_BASE}/search.json?q=${encodeURIComponent(query)}&sort=new&limit=${limit}&restrict_sr=false`
  return fetchRedditPosts(url)
}

async function searchSubreddits(query, subreddits, limit) {
  const posts = []
  for (const sub of subreddits) {
    try {
      const url = `${REDDIT_BASE}/r/${sub}/search.json?q=${encodeURIComponent(query)}&sort=new&limit=${limit}&restrict_sr=on`
      const subPosts = await fetchRedditPosts(url)
      posts.push(...subPosts)
    } catch (e) {
      console.warn(`[community] r/${sub} search failed:`, e.message)
    }
  }
  return posts
}

async function fetchRedditPosts(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  })
  if (!res.ok) throw new Error(`Reddit API ${res.status}: ${res.statusText}`)

  const json = await res.json()
  const children = json?.data?.children || []

  return children.map(c => {
    const d = c.data
    return {
      id: d.id,
      subreddit: d.subreddit,
      title: d.title?.slice(0, 200) || '',
      score: d.score || 0,
      numComments: d.num_comments || 0,
      created: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : null,
      url: d.permalink ? `https://www.reddit.com${d.permalink}` : null,
      flair: d.link_flair_text || null,
    }
  })
}

/**
 * コミュニティ投稿の統計を算出
 */
function calcCommunityStats(posts) {
  if (!posts.length) return { totalPosts: 0 }

  const scores = posts.map(p => p.score)
  const comments = posts.map(p => p.numComments)

  // 投稿頻度: 直近の投稿日付から日あたりの投稿数を推定
  const dates = posts
    .map(p => new Date(p.created).getTime())
    .filter(d => !isNaN(d))
    .sort((a, b) => b - a)

  let postsPerDay = 0
  if (dates.length >= 2) {
    const spanDays = Math.max((dates[0] - dates[dates.length - 1]) / (1000 * 60 * 60 * 24), 1)
    postsPerDay = Math.round((dates.length / spanDays) * 10) / 10
  }

  // サブレディット別の投稿数
  const bySubreddit = {}
  for (const p of posts) {
    bySubreddit[p.subreddit] = (bySubreddit[p.subreddit] || 0) + 1
  }

  return {
    totalPosts: posts.length,
    postsPerDay,
    avgScore: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
    avgComments: Math.round((comments.reduce((a, b) => a + b, 0) / comments.length) * 10) / 10,
    maxScore: Math.max(...scores),
    bySubreddit,
  }
}

function buildMockCommunity(keywords) {
  return {
    source: 'Reddit (mock)',
    fetched_at: new Date().toISOString(),
    posts: keywords.slice(0, 2).map((kw, i) => ({
      id: `mock-${i}`,
      subreddit: 'gachagaming',
      title: `${kw} の最新イベントについて`,
      score: 50 + Math.floor(Math.random() * 100),
      numComments: 10 + Math.floor(Math.random() * 40),
      created: new Date().toISOString(),
      keyword: kw,
    })),
    stats: { totalPosts: 2, postsPerDay: 1.2, avgScore: 75, avgComments: 25, maxScore: 120, bySubreddit: { gachagaming: 2 } },
  }
}
