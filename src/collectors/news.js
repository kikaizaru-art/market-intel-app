/**
 * 業界ニュース RSS コレクター
 *
 * ソース:
 *   - https://www.4gamer.net/rss/index.xml        — ゲーム全般
 *   - https://gamebiz.jp/?feed=rss2               — ゲームビジネス
 *   - https://app-store-news.net/feed/             — アプリ市場
 *   - https://applion.jp/rss/all_ranking.rss       — App Storeランキング
 */

import fs from 'fs'

// TODO: npm i rss-parser
// import RSSParser from 'rss-parser'

const RSS_FEEDS = [
  { name: '4Gamer',   url: 'https://www.4gamer.net/rss/index.xml' },
  { name: 'GameBiz',  url: 'https://gamebiz.jp/?feed=rss2' },
]

export async function fetchNews() {
  // const parser = new RSSParser()
  // const allItems = []
  // for (const feed of RSS_FEEDS) {
  //   try {
  //     const result = await parser.parseURL(feed.url)
  //     allItems.push(...result.items.slice(0, 10).map(item => ({
  //       source: feed.name,
  //       title: item.title,
  //       link: item.link,
  //       pubDate: item.pubDate,
  //       summary: item.contentSnippet?.slice(0, 200),
  //     })))
  //   } catch (e) {
  //     console.warn(`[news] failed to fetch ${feed.name}:`, e.message)
  //   }
  // }
  // return allItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))

  console.log('[news] fetchNews — not yet implemented, returning []')
  return []
}

// CLI実行時
if (process.argv[1].includes('news.js')) {
  fetchNews().then(items => {
    console.log('[news] fetched', items.length, 'items')
  }).catch(console.error)
}
