/**
 * Meta広告ライブラリ コレクター
 *
 * 公開API:
 *   https://www.facebook.com/ads/library/api/
 *   エンドポイント: https://graph.facebook.com/v19.0/ads_archive
 *
 * 必要なもの:
 *   - Meta開発者アカウント（無料）
 *   - アクセストークン（公開API用）
 *   - config/.env に META_ACCESS_TOKEN=xxx を設定
 *
 * リクエスト例:
 *   GET https://graph.facebook.com/v19.0/ads_archive
 *     ?access_token=<TOKEN>
 *     &ad_type=ALL
 *     &ad_reached_countries=JP
 *     &search_terms=パズルゲーム
 *     &fields=id,ad_creation_time,ad_creative_bodies,ad_creative_link_titles,
 *             ad_delivery_start_time,ad_delivery_stop_time,
 *             advertiser_name,page_name,reach_estimate
 */

import fs from 'fs'

const META_API_BASE = 'https://graph.facebook.com/v19.0/ads_archive'
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN ?? null

export async function fetchMetaAds({ searchTerms = [], country = 'JP' } = {}) {
  if (!ACCESS_TOKEN) {
    console.warn('[meta-ads] META_ACCESS_TOKEN not set — returning mock data')
    const mockPath = new URL('../../data/mock/meta-ads.json', import.meta.url)
    return JSON.parse(fs.readFileSync(mockPath))
  }

  const results = []
  for (const term of searchTerms) {
    try {
      console.log(`[meta-ads] searching: "${term}"...`)
      const url = new URL(META_API_BASE)
      url.searchParams.set('access_token', ACCESS_TOKEN)
      url.searchParams.set('ad_type', 'ALL')
      url.searchParams.set('ad_reached_countries', country)
      url.searchParams.set('search_terms', term)
      url.searchParams.set('fields', [
        'id', 'ad_creation_time', 'ad_creative_bodies',
        'ad_delivery_start_time', 'ad_delivery_stop_time',
        'advertiser_name', 'page_name',
      ].join(','))
      url.searchParams.set('limit', '25')
      const res = await fetch(url.toString())
      const json = await res.json()
      if (json.error) {
        console.warn(`[meta-ads] API error for "${term}":`, json.error.message)
      } else {
        console.log(`[meta-ads]   "${term}": ${json.data?.length ?? 0} ads`)
        results.push(...(json.data ?? []))
      }
    } catch (e) {
      console.warn(`[meta-ads] fetch failed for "${term}":`, e.message)
    }
  }
  return { source: 'Meta Ad Library', fetched_at: new Date().toISOString(), ads: results }
}

// CLI実行時
if (process.argv[1].includes('meta-ads.js')) {
  const config = JSON.parse(fs.readFileSync(new URL('../../config/targets.json', import.meta.url)))
  const titles = config.titles.map(t => t.name)
  fetchMetaAds({ searchTerms: titles }).then(data => {
    console.log('[meta-ads] fetched', data?.ads?.length ?? 0, 'ads')
  }).catch(console.error)
}
