/**
 * YouTube チャンネル統計コレクター (Phase 2)
 *
 * YouTube Data API v3 を使い、各対象チャンネルの
 *   - 登録者数 / 総再生数 / 投稿本数
 *   - 直近アップロードの視聴/いいね/コメント数
 *   - 直近30日の投稿頻度と平均再生数
 * を取得する。
 *
 * API キーが未設定、またはチャンネルIDが指定されていない対象については
 * モックデータを返し、他の収集は継続できるようにする。
 *
 * 必要な環境変数:
 *   YOUTUBE_API_KEY — YouTube Data API v3 のAPIキー
 *
 * 使用エンドポイント:
 *   - channels.list       (snippet, statistics, contentDetails)
 *   - playlistItems.list  (uploads プレイリストの直近動画ID)
 *   - videos.list         (直近動画の statistics)
 *
 * API コスト (概算):
 *   1 チャンネルあたり 3 quota (channels + playlistItems + videos)
 *   無料枠 10,000/日 で 3,000 チャンネル/日までフェッチ可能
 */

const YT_BASE = 'https://www.googleapis.com/youtube/v3'
const UPLOADS_PAGE_SIZE = 50
const RECENT_VIDEO_SAMPLE = 10

/**
 * YouTube チャンネル統計を取得
 *
 * @param {Object} options
 * @param {Object} options.sources - ドメイン設定の sources.youtube-channels
 * @param {Array}  options.targets - 対象チャンネル配列 (identifiers.youtube_channel_id 必須)
 * @returns {Promise<Object>} 統計データ ({ source, fetched_at, channels })
 */
export async function fetchYouTubeChannels({ sources, targets } = {}) {
  const apiKey = process.env.YOUTUBE_API_KEY
  const channelTargets = (targets || []).filter(t => t?.identifiers?.youtube_channel_id)

  if (channelTargets.length === 0) {
    console.warn('[youtube-channels] no youtube_channel_id in targets — skipping')
    return {
      source: 'YouTube Data API (skipped)',
      fetched_at: new Date().toISOString(),
      channels: [],
    }
  }

  if (!apiKey) {
    console.warn('[youtube-channels] YOUTUBE_API_KEY not set — returning mock data')
    return generateMockData(channelTargets)
  }

  const channels = []
  for (const target of channelTargets) {
    const channelId = target.identifiers.youtube_channel_id
    try {
      console.log(`[youtube-channels] fetching ${target.name} (${channelId})...`)
      const stats = await fetchChannelStats(channelId, apiKey)
      channels.push({
        id: target.id,
        name: target.name,
        category: target.category,
        platform: 'youtube',
        channel_id: channelId,
        ...stats,
      })
    } catch (e) {
      console.warn(`[youtube-channels] failed ${target.name}: ${e.message}`)
      channels.push({
        id: target.id,
        name: target.name,
        category: target.category,
        platform: 'youtube',
        channel_id: channelId,
        error: e.message,
      })
    }
  }

  return {
    source: 'YouTube Data API v3',
    fetched_at: new Date().toISOString(),
    channels,
  }
}

async function fetchChannelStats(channelId, apiKey) {
  // 1. channels.list — snippet / statistics / contentDetails
  const chRes = await ytGet(`${YT_BASE}/channels`, {
    part: 'snippet,statistics,contentDetails',
    id: channelId,
    key: apiKey,
  })
  const ch = chRes.items?.[0]
  if (!ch) throw new Error(`channel not found: ${channelId}`)

  const snippet = ch.snippet || {}
  const statistics = ch.statistics || {}
  const uploadsPlaylistId = ch.contentDetails?.relatedPlaylists?.uploads || null

  // 2. playlistItems.list — 直近アップロード (最大50本)
  let recentVideoIds = []
  if (uploadsPlaylistId) {
    try {
      const plRes = await ytGet(`${YT_BASE}/playlistItems`, {
        part: 'contentDetails',
        playlistId: uploadsPlaylistId,
        maxResults: UPLOADS_PAGE_SIZE,
        key: apiKey,
      })
      recentVideoIds = (plRes.items || [])
        .map(it => it.contentDetails?.videoId)
        .filter(Boolean)
    } catch (e) {
      console.warn(`[youtube-channels]   playlistItems failed: ${e.message}`)
    }
  }

  // 3. videos.list — 直近動画の snippet + statistics
  let recentVideos = []
  if (recentVideoIds.length > 0) {
    try {
      const vRes = await ytGet(`${YT_BASE}/videos`, {
        part: 'snippet,statistics',
        id: recentVideoIds.join(','),
        key: apiKey,
      })
      recentVideos = (vRes.items || []).map(v => ({
        id: v.id,
        title: v.snippet?.title || '',
        publishedAt: v.snippet?.publishedAt || null,
        viewCount: toInt(v.statistics?.viewCount) ?? 0,
        likeCount: toInt(v.statistics?.likeCount) ?? 0,
        commentCount: toInt(v.statistics?.commentCount) ?? 0,
      }))
    } catch (e) {
      console.warn(`[youtube-channels]   videos.list failed: ${e.message}`)
    }
  }

  // 直近30日の集計
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
  const last30 = recentVideos.filter(v => {
    const ts = v.publishedAt ? Date.parse(v.publishedAt) : NaN
    return Number.isFinite(ts) && ts >= thirtyDaysAgo
  })
  const total = (arr, key) => arr.reduce((s, v) => s + (v[key] || 0), 0)
  const avg = (arr, key) => (arr.length ? Math.round(total(arr, key) / arr.length) : 0)
  const totalViews30d = total(last30, 'viewCount')
  const avgViews30d = avg(last30, 'viewCount')
  const avgLikes30d = avg(last30, 'likeCount')
  const avgComments30d = avg(last30, 'commentCount')
  const engagementRate30d = avgViews30d
    ? Math.round(((avgLikes30d + avgComments30d) / avgViews30d) * 10000) / 100
    : 0

  return {
    title: snippet.title || null,
    description: (snippet.description || '').slice(0, 200),
    country: snippet.country || null,
    published_at: snippet.publishedAt || null,
    uploads_playlist_id: uploadsPlaylistId,
    subscribers: toInt(statistics.subscriberCount),
    hidden_subscriber_count: !!statistics.hiddenSubscriberCount,
    total_views: toInt(statistics.viewCount),
    video_count: toInt(statistics.videoCount),
    posts_30d: last30.length,
    total_views_30d: totalViews30d,
    avg_views_30d: avgViews30d,
    avg_likes_30d: avgLikes30d,
    avg_comments_30d: avgComments30d,
    engagement_rate_30d: engagementRate30d,
    recent_videos: recentVideos.slice(0, RECENT_VIDEO_SAMPLE),
  }
}

function toInt(v) {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

async function ytGet(baseUrl, params) {
  const url = new URL(baseUrl)
  for (const [k, v] of Object.entries(params)) {
    if (v != null) url.searchParams.set(k, String(v))
  }
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const body = await res.json()
      if (body?.error?.message) detail += ` - ${body.error.message}`
    } catch {
      // body is not JSON — ignore
    }
    throw new Error(detail)
  }
  return res.json()
}

function generateMockData(targets) {
  const channels = (targets || []).map((target) => ({
    id: target.id,
    name: target.name,
    category: target.category,
    platform: 'youtube',
    channel_id: target.identifiers?.youtube_channel_id || null,
    title: target.name,
    description: '',
    country: 'JP',
    published_at: null,
    uploads_playlist_id: null,
    subscribers: Math.round(500000 + Math.random() * 9500000),
    hidden_subscriber_count: false,
    total_views: Math.round(100000000 + Math.random() * 9900000000),
    video_count: Math.round(200 + Math.random() * 2800),
    posts_30d: Math.round(5 + Math.random() * 25),
    total_views_30d: Math.round(1000000 + Math.random() * 50000000),
    avg_views_30d: Math.round(50000 + Math.random() * 950000),
    avg_likes_30d: Math.round(1000 + Math.random() * 50000),
    avg_comments_30d: Math.round(100 + Math.random() * 3000),
    engagement_rate_30d: Math.round((2 + Math.random() * 8) * 100) / 100,
    recent_videos: [],
  }))

  return {
    source: 'YouTube Data API (mock)',
    fetched_at: new Date().toISOString(),
    channels,
  }
}

// CLI 実行
if (process.argv[1] && process.argv[1].includes('youtube-channels')) {
  const targets = [
    { id: 'hikakin', name: 'HIKAKIN', category: 'エンタメ',
      identifiers: { youtube_channel_id: 'UCZf__ehlCEBPop-_sldpBUQ' } },
  ]
  fetchYouTubeChannels({ targets }).then(data => {
    console.log(JSON.stringify(data, null, 2))
  }).catch(e => {
    console.error(e)
    process.exit(1)
  })
}
