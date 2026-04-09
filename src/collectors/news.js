/**
 * 業界ニュース RSS コレクター
 *
 * ソース:
 *   - https://www.4gamer.net/rss/index.xml        — ゲーム全般
 *   - https://gamebiz.jp/?feed=rss2               — ゲームビジネス
 */

import fs from 'fs'
import RSSParser from 'rss-parser'

const RSS_FEEDS = [
  { name: '4Gamer',    url: 'https://www.4gamer.net/rss/index.xml' },
  { name: 'AUTOMATON', url: 'https://automaton-media.com/feed/' },
  { name: 'Inside',    url: 'https://www.inside-games.jp/rss/index.rdf' },
  { name: 'GameSpark', url: 'https://www.gamespark.jp/rss/index.rdf' },
]

export async function fetchNews() {
  const parser = new RSSParser({ timeout: 15000 })
  const allItems = []
  for (const feed of RSS_FEEDS) {
    try {
      console.log(`[news] fetching ${feed.name}...`)
      const result = await parser.parseURL(feed.url)
      const items = result.items.slice(0, 10).map(item => ({
        source: feed.name,
        title: item.title,
        link: item.link,
        pubDate: item.pubDate ?? item.isoDate ?? null,
        summary: (item.contentSnippet ?? item.content ?? '').slice(0, 200),
      }))
      allItems.push(...items)
      console.log(`[news]   ${feed.name}: ${items.length} articles`)
    } catch (e) {
      console.warn(`[news] failed to fetch ${feed.name}:`, e.message)
    }
  }
  return allItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
}

// CLI実行時
if (process.argv[1].includes('news.js')) {
  fetchNews().then(items => {
    console.log('[news] fetched', items.length, 'items')
  }).catch(console.error)
}
