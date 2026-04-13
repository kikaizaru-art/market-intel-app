/**
 * 収集した実データを読み込み、ダッシュボードのコンポーネントが期待する形式に変換する
 *
 * trends, reviews, ranking, community, news の全データタイプに対応
 */

const COLLECTED_URL = './data/collected.json'

export async function loadCollectedData() {
  try {
    const res = await fetch(COLLECTED_URL)
    if (!res.ok) {
      console.warn(`[loadCollectedData] fetch failed: ${res.status} ${res.statusText}`)
      return null
    }
    const raw = await res.json()
    console.log('[loadCollectedData] raw data keys:', Object.keys(raw))

    const result = {
      collected_at: raw.collected_at,
      trends: transformTrends(raw.trends),
      reviews: transformReviews(raw.reviews),
      ranking: transformRanking(raw.ranking),
      community: transformCommunity(raw.community),
      news: transformNews(raw.news),
    }

    // 変換結果のサマリーをログ
    const loaded = Object.entries(result)
      .filter(([k, v]) => k !== 'collected_at' && v)
      .map(([k]) => k)
    console.log('[loadCollectedData] transformed:', loaded.join(', ') || 'none')

    return result
  } catch (e) {
    console.warn('[loadCollectedData] failed to load collected data:', e.message)
    return null
  }
}

/**
 * Google Trends → MacroView / IndustryView 形式
 */
function transformTrends(trends) {
  if (!trends?.weekly?.length) return null
  return {
    source: 'Google Trends (実データ)',
    geo: trends.geo || 'JP',
    weekly: trends.weekly,
    _genres: trends.keywords || Object.keys(trends.weekly[0]).filter(k => k !== 'date'),
  }
}

/**
 * Google Play Reviews → UserView 形式
 */
function transformReviews(reviews) {
  if (!reviews?.apps?.length) return null

  const apps = reviews.apps.map(app => {
    const recentReviews = app.recentReviews || []
    const positiveCount = recentReviews.filter(r => r.score >= 4).length
    const negativeReviews = recentReviews.filter(r => r.score <= 2)
    const positiveReviewTexts = recentReviews.filter(r => r.score >= 4)
    const positiveRatio = recentReviews.length > 0 ? positiveCount / recentReviews.length : 0.5

    const complaints = extractTopPhrases(negativeReviews.map(r => r.text))
    const praises = extractTopPhrases(positiveReviewTexts.map(r => r.text))

    const now = new Date()
    const month = now.toISOString().slice(0, 7)

    return {
      id: app.id,
      name: app.name,
      genre: app.genre,
      monthly: [{
        month,
        score: Math.round((app.appInfo?.score || 0) * 10) / 10,
        count: app.appInfo?.reviews || recentReviews.length,
        positive_ratio: Math.round(positiveRatio * 100) / 100,
      }],
      top_complaints: complaints.length > 0 ? complaints : ['データ不足'],
      top_praises: praises.length > 0 ? praises : ['データ不足'],
    }
  })

  return { source: 'Google Play (実データ)', apps }
}

/**
 * レビューテキストから代表的なフレーズを抽出（簡易版）
 */
function extractTopPhrases(texts) {
  if (texts.length === 0) return []
  return texts
    .filter(t => t && t.length > 5)
    .slice(0, 3)
    .map(t => t.slice(0, 50) + (t.length > 50 ? '...' : ''))
}

/**
 * RSS News → MarketFundamentalsView.news / IndustryView.news 形式
 */
function transformNews(news) {
  if (!Array.isArray(news) || news.length === 0) return null
  return news.map(item => ({
    date: item.pubDate ? new Date(item.pubDate).toISOString().slice(0, 10) : '',
    title: item.title || '',
    source: item.source || '',
    url: item.link || null,
    tags: guessNewsTags(item.title || ''),
  }))
}

/**
 * Store Ranking → 競合ポジション形式
 */
function transformRanking(ranking) {
  if (!ranking?.targetPositions?.length) return null
  return {
    source: ranking.source || 'Google Play Ranking',
    genre: ranking.genre,
    positions: ranking.targetPositions,
    topGrossing: ranking.rankings?.top_grossing || [],
    topFree: ranking.rankings?.top_free || [],
  }
}

/**
 * Community → コミュニティ活動形式
 */
function transformCommunity(community) {
  if (!community?.stats) return null
  return {
    source: community.source || 'Reddit',
    stats: community.stats,
    posts: (community.posts || []).slice(0, 20).map(p => ({
      title: p.title,
      subreddit: p.subreddit,
      score: p.score,
      numComments: p.numComments,
      created: p.created,
      keyword: p.keyword,
    })),
  }
}

/**
 * ニュースタイトルからタグを推定
 */
function guessNewsTags(title) {
  const tags = []
  const rules = [
    [/RPG|ロールプレイ/, 'RPG'],
    [/パズル|マッチ/, 'パズル'],
    [/ランキング|売上|セールス/, 'ランキング'],
    [/規制|法|ガイドライン/, '規制'],
    [/Apple|iOS|App Store/, 'Apple'],
    [/Google|Android|Play/, 'Google'],
    [/広告|CPI|UA/, '広告'],
    [/決算|IR|業績/, '決算'],
    [/海外|グローバル|Global/, '海外展開'],
    [/事前登録|新作/, '事前登録'],
    [/ストラテジー|戦略/, 'ストラテジー'],
    [/カジュアル/, 'カジュアル'],
    [/アクション|バトル/, 'アクション'],
    [/ストア|配信/, 'ストア'],
    [/シミュレーション/, 'シミュレーション'],
  ]
  for (const [regex, tag] of rules) {
    if (regex.test(title)) tags.push(tag)
  }
  if (tags.length === 0) tags.push('市場動向')
  return tags
}
