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

    // ニュースのアプリタグ付けに使うアプリ名リストを構築
    const appNames = extractAppNames(raw.reviews, raw.trends)

    const result = {
      collected_at: raw.collected_at,
      domain: raw.domain || null,
      trends: transformTrends(raw.trends),
      reviews: transformReviews(raw.reviews, raw.collected_at),
      ranking: transformRanking(raw.ranking),
      community: transformCommunity(raw.community),
      news: transformNews(raw.news, appNames),
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
 *
 * 履歴蓄積データ (monthlyHistory) があれば推移チャートに反映し、
 * 最新のレビューテキストから苦情・賞賛を抽出する。
 */
function transformReviews(reviews, collected_at) {
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

    // 蓄積済み月次履歴があれば使用、なければ今月のスナップショットのみ
    let monthly
    if (app.monthlyHistory?.length) {
      monthly = app.monthlyHistory.map(h => ({
        month: h.month,
        score: Math.round((h.score || 0) * 10) / 10,
        count: h.reviews || h.ratings || 0,
        positive_ratio: calcPositiveRatio(h.histogram),
        version: h.version || null,
        recentChanges: h.recentChanges || null,
      }))
    } else {
      monthly = [{
        month,
        score: Math.round((app.appInfo?.score || 0) * 10) / 10,
        count: app.appInfo?.reviews || recentReviews.length,
        positive_ratio: Math.round(positiveRatio * 100) / 100,
      }]
    }

    return {
      id: app.id,
      name: app.name,
      genre: app.genre,
      isMain: app.isMain || false,
      monthly,
      histogram: app.appInfo?.histogram || null,
      reviewVelocity: app.reviewVelocity || null,
      top_complaints: complaints.length > 0 ? complaints : ['データ不足'],
      top_praises: praises.length > 0 ? praises : ['データ不足'],
      recentReviews: recentReviews.slice(0, 10),
      // 蓄積された個別レビュー本文 (日付降順, 最大1000件 / appVersion 紐付き)
      // L3 ユーザー層の時系列分析・バージョン別センチメント推移に使用
      reviewTextsHistory: app.reviewTextsHistory || [],
    }
  })

  return { source: 'Google Play (実データ)', apps, collected_at: collected_at || null }
}

/**
 * ヒストグラムからポジティブ比率を算出
 * (4-5星 / 全体)
 */
function calcPositiveRatio(histogram) {
  if (!histogram) return 0.5
  const total = Object.values(histogram).reduce((a, b) => a + (b || 0), 0)
  if (total === 0) return 0.5
  const positive = (histogram['4'] || 0) + (histogram['5'] || 0)
  return Math.round((positive / total) * 100) / 100
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
 * 収集データからアプリ名リストを抽出 (ニュースタグ付けに使用)
 *
 * reviews.apps[].name と trends.keywords から重複なしで収集。
 * 短すぎる名前 (2文字以下) はノイズ源になるので除外。
 */
function extractAppNames(reviews, trends) {
  const names = new Map() // name → id (表示名→識別子)
  if (reviews?.apps?.length) {
    for (const app of reviews.apps) {
      if (app.name && app.name.length > 2) {
        names.set(app.name, app.id || app.name)
      }
    }
  }
  // Google Trends キーワードも対象に (アプリ名と一致しないものも含む)
  if (trends?.keywords?.length) {
    for (const kw of trends.keywords) {
      if (kw && kw.length > 2 && !names.has(kw)) {
        names.set(kw, kw)
      }
    }
  }
  return names
}

/**
 * ニュースのタイトル/サマリーにアプリ名が含まれていればタグ付け
 */
function tagNewsWithApps(title, summary, appNames) {
  if (!appNames || appNames.size === 0) return []
  const text = `${title} ${summary || ''}`.toLowerCase()
  const matched = []
  for (const [name] of appNames) {
    if (text.includes(name.toLowerCase())) {
      matched.push(name)
    }
  }
  return matched
}

/**
 * RSS News → MarketFundamentalsView.news / IndustryView.news 形式
 */
function transformNews(news, appNames) {
  if (!Array.isArray(news) || news.length === 0) return null
  return news.map(item => ({
    date: item.pubDate ? new Date(item.pubDate).toISOString().slice(0, 10) : '',
    title: item.title || '',
    source: item.source || '',
    url: item.link || null,
    tags: guessNewsTags(item.title || ''),
    appTags: tagNewsWithApps(item.title || '', item.summary || item.contentSnippet || '', appNames),
  }))
}

/**
 * Store Ranking → 競合ポジション形式 (履歴対応)
 */
function transformRanking(ranking) {
  if (!ranking?.targetPositions?.length) return null
  return {
    source: ranking.source || 'Google Play Ranking',
    genre: ranking.genre,
    positions: ranking.targetPositions,
    topGrossing: ranking.rankings?.top_grossing || [],
    topFree: ranking.rankings?.top_free || [],
    // 日次ランキング推移 (蓄積データがあれば)
    history: (ranking.history || []).map(h => ({
      date: h.date,
      positions: h.positions,
    })),
  }
}

/**
 * Community → コミュニティ活動形式 (履歴対応)
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
    // 日次コミュニティ活動推移 (蓄積データがあれば)
    history: (community.history || []).map(h => ({
      date: h.date,
      totalPosts: h.stats?.totalPosts || 0,
      postsPerDay: h.stats?.postsPerDay || 0,
      avgScore: h.stats?.avgScore || 0,
    })),
  }
}

/**
 * レビュー履歴の月次バージョン変化から自動イベントを生成
 *
 * monthlyHistory の連続する月を比較し、version が変わった箇所を
 * 「アップデート」イベントとして返す。因果エンジンに流し込み、
 * detectAnomalyEventPatterns() の入力として使う。
 *
 * @returns {{ source: string, events: object[] }}
 */
export function detectVersionEvents(reviewsData) {
  const events = []
  if (!reviewsData?.apps?.length) return { source: 'ストア更新履歴 (自動検出)', events }

  for (const app of reviewsData.apps) {
    const monthly = app.monthly
    if (!monthly || monthly.length < 2) continue

    for (let i = 1; i < monthly.length; i++) {
      const prev = monthly[i - 1]
      const curr = monthly[i]
      if (!curr.version || !prev.version) continue
      if (curr.version === prev.version) continue

      // バージョンが変わった → アップデートイベント
      const changeText = curr.recentChanges
        ? curr.recentChanges.replace(/<[^>]*>/g, '').slice(0, 60)
        : ''
      const summary = changeText ? `: ${changeText}` : ''
      events.push({
        app: app.name,
        type: 'アップデート',
        name: `v${curr.version} アップデート${summary}`,
        start: `${curr.month}-01`,
        end: null,
        source: 'ストア更新',
        auto: true,
        prevVersion: prev.version,
        newVersion: curr.version,
      })
    }
  }
  return { source: 'ストア更新履歴 (自動検出)', events }
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
