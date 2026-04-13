/**
 * YouTube チャンネルデータ収集 (Phase 2)
 *
 * YouTube Data API v3 を使用して、チャンネルの登録者数・再生数・動画数を取得する。
 * API キーが設定されていない場合はモックデータを返す。
 *
 * 必要な環境変数:
 *   YOUTUBE_API_KEY — YouTube Data API v3 のAPIキー
 *
 * 使用するAPI:
 *   - channels.list (snippet, statistics)
 *   - search.list (channel videos)
 *   - videos.list (statistics for recent videos)
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * YouTube チャンネル統計を取得
 *
 * @param {Object} options
 * @param {Object} options.sources - ドメイン設定の sources
 * @param {Array} options.targets - 対象チャンネル配列
 * @returns {Promise<Object>} チャンネル統計データ
 */
export async function fetchYouTubeChannels({ sources, targets } = {}) {
  const apiKey = process.env.YOUTUBE_API_KEY

  if (!apiKey) {
    console.warn('[youtube-channels] YOUTUBE_API_KEY not set — returning mock data')
    return generateMockData(targets)
  }

  // Phase 2: 実API実装
  // const baseUrl = 'https://www.googleapis.com/youtube/v3'
  // const channelIds = targets.map(t => t.identifiers.youtube_channel_id).filter(Boolean)
  // ...

  console.warn('[youtube-channels] Real API not yet implemented — returning mock data')
  return generateMockData(targets)
}

function generateMockData(targets) {
  const channels = (targets || []).map((target, i) => ({
    id: target.id,
    name: target.name,
    platform: 'youtube',
    subscribers: Math.round(500000 + Math.random() * 9500000),
    total_views: Math.round(100000000 + Math.random() * 9900000000),
    video_count: Math.round(200 + Math.random() * 2800),
    avg_views_30d: Math.round(50000 + Math.random() * 950000),
    engagement_rate: Math.round((2 + Math.random() * 8) * 100) / 100,
    subscriber_growth_30d: Math.round(-1000 + Math.random() * 50000),
    top_categories: target.category ? [target.category] : ['エンタメ'],
  }))

  return {
    source: 'YouTube Data API (mock)',
    fetched_at: new Date().toISOString(),
    channels,
  }
}

// スタンドアロン実行
if (process.argv[1] && process.argv[1].includes('youtube-channels')) {
  fetchYouTubeChannels().then(data => {
    console.log(JSON.stringify(data, null, 2))
  })
}
