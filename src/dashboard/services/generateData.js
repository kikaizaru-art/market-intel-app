/**
 * Generate contextual mock data based on user input (app name, company, genre).
 * When real APIs are connected (Phase 2), this will be replaced by actual data collection.
 */

const GENRE_POOL = {
  'パズル': {
    keywords: ['パズルゲーム', 'マッチ3', 'ブロックパズル', '脳トレ'],
    competitors: ['パズル&ドラゴンズ', 'ツムツム', 'キャンディクラッシュ', 'トゥーンブラスト'],
    companies: ['ガンホー', 'LINE', 'King', 'Peak Games'],
    complaints: ['広告が多すぎる', '難易度が急に上がる', '読み込みが遅い', 'スタミナ制限がきつい'],
    praises: ['パズルが面白い', '暇つぶしに最適', 'グラフィックきれい', '無課金でも楽しめる'],
    hooks: ['「このレベル、誰でも解けます」系', 'ビフォーアフター系', '失敗系リアクション', 'ASMR系'],
  },
  'RPG': {
    keywords: ['RPGスマホ', 'ガチャゲー', 'ターン制RPG', 'アクションRPG'],
    competitors: ['原神', 'FGO', 'ウマ娘', 'ブルーアーカイブ'],
    companies: ['miHoYo', 'アニプレックス', 'Cygames', 'Yostar'],
    complaints: ['ガチャ確率が低い', 'スタミナ消費が早い', 'PvPバランスが悪い', 'インフレが激しい'],
    praises: ['ストーリーが面白い', 'キャラデザが良い', 'イベントが充実', 'BGMが素晴らしい'],
    hooks: ['キャラクター紹介系', 'コラボ告知系', '最強編成紹介系', 'ストーリー訴求系'],
  },
  'カジュアル': {
    keywords: ['カジュアルゲーム', '暇つぶしゲーム', 'ハイパーカジュアル', 'ミニゲーム'],
    competitors: ['Among Us', 'Subway Surfers', '2048', 'Flappy Bird系'],
    companies: ['Voodoo', 'Ketchapp', 'SayGames', 'Lion Studios'],
    complaints: ['すぐ飽きる', '課金圧が強い', 'バグが多い', '広告がうざい'],
    praises: ['操作が簡単', 'サクッと遊べる', '無料で十分楽しめる', 'テンポが良い'],
    hooks: ['失敗系リアクション', 'UGC風ナチュラル系', '「暇なときにどうぞ」系', 'スコアチャレンジ系'],
  },
  'ストラテジー': {
    keywords: ['ストラテジー', '戦略ゲーム', 'タワーディフェンス', '城ゲー'],
    competitors: ['クラロワ', 'Rise of Kingdoms', 'アークナイツ', 'ドミネーションズ'],
    companies: ['Supercell', 'Lilith Games', 'Yostar', 'Nexon'],
    complaints: ['課金者が強すぎる', 'マッチングが不公平', 'アプデが遅い', 'UIが分かりにくい'],
    praises: ['戦略性が高い', 'やりこみ要素が豊富', 'ギルドが楽しい', 'グラフィックが綺麗'],
    hooks: ['「無課金でも最強」系', 'ランキング訴求系', '攻略紹介系', 'PvPハイライト系'],
  },
  'アクション': {
    keywords: ['アクションゲーム', 'バトルロイヤル', 'シューティング', '格闘ゲーム'],
    competitors: ['PUBG Mobile', '荒野行動', 'Brawl Stars', 'シャドウファイト'],
    companies: ['Krafton', 'NetEase', 'Supercell', 'Nekki'],
    complaints: ['ラグがひどい', 'チーターが多い', 'マッチング遅い', '容量が大きい'],
    praises: ['操作感が良い', 'グラフィックが最高', '友達と遊べる', 'eスポーツが熱い'],
    hooks: ['ハイライトプレイ系', 'eスポーツ訴求系', '新シーズン告知系', 'コラボ系'],
  },
  'シミュレーション': {
    keywords: ['シミュレーション', '経営ゲーム', '育成ゲーム', '箱庭ゲーム'],
    competitors: ['どうぶつの森', 'シムシティ', 'スタデューバレー', 'ポケモンGO'],
    companies: ['Nintendo', 'EA', 'ConcernedApe', 'Niantic'],
    complaints: ['コンテンツ不足', '課金要素が多い', '進行が遅い', 'イベントが単調'],
    praises: ['まったり遊べる', '自由度が高い', '癒やされる', 'コレクション要素が楽しい'],
    hooks: ['ビフォーアフター系', '建設タイムラプス系', 'コレクション紹介系', '癒やし系'],
  },
}

const DEFAULT_GENRE = 'RPG'

function seededRandom(seed) {
  let s = 0
  for (let i = 0; i < seed.length; i++) s = ((s << 5) - s + seed.charCodeAt(i)) | 0
  return function () {
    s = (s * 16807 + 0) % 2147483647
    return (s & 0x7fffffff) / 2147483647
  }
}

function pick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)]
}

function randRange(min, max, rng) {
  return Math.round(min + rng() * (max - min))
}

function generateWeeklyDates(weeks = 26) {
  const dates = []
  const now = new Date('2026-04-05')
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i * 7)
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}

function generateMonthlyDates(months = 6) {
  const dates = []
  const base = new Date('2026-03-01')
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(base)
    d.setMonth(d.getMonth() - i)
    dates.push(d.toISOString().slice(0, 7))
  }
  return dates
}

export function generateCompetitorData(target) {
  const { appName, companyName, genre } = target
  const genreInfo = GENRE_POOL[genre] || GENRE_POOL[DEFAULT_GENRE]
  const rng = seededRandom(appName + companyName + genre)

  // Pick 3 competitors
  const competitorApps = genreInfo.competitors.slice(0, 3)
  const competitorCompanies = genreInfo.companies.slice(0, 3)

  const allApps = [
    { id: 'target', name: appName, genre, company: companyName },
    ...competitorApps.map((name, i) => ({
      id: `comp-${i}`,
      name,
      genre,
      company: competitorCompanies[i] || `競合企業${i + 1}`,
    })),
  ]

  const allCompanies = [
    companyName,
    ...competitorCompanies,
  ]

  return {
    target,
    trends: generateTrends(genre, genreInfo, rng),
    ads: generateAds(allApps, allCompanies, genreInfo, rng),
    reviews: generateReviews(allApps, genreInfo, rng),
    corporate: generateCorporate(allApps, allCompanies, genre, rng),
    fundamentals: generateFundamentals(allApps, genre, rng),
    events: generateEvents(allApps, rng),
    causation: generateCausation(allApps, rng),
    industry: generateIndustry(genre, genreInfo, rng),
  }
}

function generateTrends(genre, genreInfo, rng) {
  const dates = generateWeeklyDates(26)
  const genres = [genre, ...Object.keys(GENRE_POOL).filter(g => g !== genre).slice(0, 4)]
  const baseLevels = { [genres[0]]: 80, [genres[1]]: 65, [genres[2]]: 55, [genres[3]]: 45, [genres[4]]: 35 }

  const weekly = dates.map((date, i) => {
    const row = { date }
    for (const g of genres) {
      const base = baseLevels[g] || 50
      const seasonal = Math.sin((i / 26) * Math.PI * 2) * 8
      const noise = (rng() - 0.5) * 12
      row[g] = Math.max(10, Math.min(100, Math.round(base + seasonal + noise + i * 0.3)))
    }
    return row
  })

  return {
    source: 'Google Trends (generated)',
    geo: 'JP',
    weekly,
    _genres: genres,
  }
}

function generateAds(allApps, allCompanies, genreInfo, rng) {
  const ads = []
  const genres = Object.keys(GENRE_POOL).slice(0, 4)
  let id = 1

  for (const company of allCompanies) {
    const count = randRange(1, 4, rng)
    for (let i = 0; i < count; i++) {
      const app = allApps.find(a => a.company === company) || allApps[0]
      const day = randRange(1, 28, rng)
      const month = randRange(1, 4, rng)
      ads.push({
        id: `ad_${String(id++).padStart(3, '0')}`,
        advertiser: company,
        title: app.name,
        genre: app.genre || pick(genres, rng),
        format: rng() > 0.4 ? '動画' : '画像',
        platforms: rng() > 0.5
          ? ['Facebook', 'Instagram']
          : rng() > 0.5
            ? ['Facebook', 'Instagram', 'Audience Network']
            : ['Facebook'],
        started: `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        status: rng() > 0.25 ? 'active' : 'inactive',
        reach_estimate: rng() > 0.6 ? '高' : rng() > 0.3 ? '中' : '低',
        creative_hook: pick(genreInfo.hooks, rng),
        thumbnail_url: null,
      })
    }
  }

  return { source: 'Meta Ad Library (generated)', fetched_at: '2026-04-08', ads }
}

function generateReviews(allApps, genreInfo, rng) {
  const months = generateMonthlyDates(6)

  const apps = allApps.slice(0, 3).map(app => {
    const baseScore = 3.5 + rng() * 1.2
    const monthly = months.map((month, i) => {
      const trend = (rng() - 0.4) * 0.3
      const score = Math.round((baseScore + trend + i * 0.05) * 10) / 10
      return {
        month,
        score: Math.max(2.5, Math.min(5.0, score)),
        count: randRange(300, 3000, rng),
        positive_ratio: Math.round((0.55 + rng() * 0.3) * 100) / 100,
      }
    })

    const complaints = []
    const praises = []
    const pool = [...genreInfo.complaints]
    const praisePool = [...genreInfo.praises]
    for (let i = 0; i < 3; i++) {
      const ci = Math.floor(rng() * pool.length)
      complaints.push(pool.splice(ci, 1)[0] || genreInfo.complaints[i])
      const pi = Math.floor(rng() * praisePool.length)
      praises.push(praisePool.splice(pi, 1)[0] || genreInfo.praises[i])
    }

    return {
      id: app.id,
      name: app.name,
      genre: app.genre,
      monthly,
      top_complaints: complaints,
      top_praises: praises,
    }
  })

  return { source: 'App Store / Google Play (generated)', apps }
}

function generateCorporate(allApps, allCompanies, genre, rng) {
  const quarters = ['2025Q2', '2025Q3', '2025Q4', '2026Q1']
  const statusOptions = ['運営中', '開発中']
  const hiringPools = [
    ['Unityエンジニア', 'サーバーエンジニア', '3Dアーティスト', 'プランナー'],
    ['プランナー', 'UIデザイナー', 'QAエンジニア'],
    ['マーケター', 'データアナリスト', 'CS'],
    ['JP Market Manager', 'ローカライズ', 'CS(日本語)', 'プロダクトマネージャー'],
  ]
  const trendOptions = ['increasing', 'stable', 'decreasing']
  const segmentOptions = ['ゲーム事業', 'モバイルゲーム', 'エンタメ事業', 'Mobile Games']

  const companies = allCompanies.slice(0, 4).map((name, i) => {
    const baseRevenue = 5 + rng() * 50
    const quarterly_financials = quarters.map((quarter, qi) => {
      const growth = 1 + (rng() - 0.3) * 0.15
      const rev = Math.round((baseRevenue * (1 + qi * 0.08) * growth) * 10) / 10
      const margin = Math.round((15 + rng() * 15) * 10) / 10
      return {
        quarter,
        revenue_b: rev,
        op_profit_b: Math.round(rev * margin / 100 * 10) / 10,
        op_margin: margin,
      }
    })

    const companyApps = allApps.filter(a => a.company === name)
    const titles = companyApps.length > 0
      ? companyApps.map(a => ({
          name: a.name,
          status: '運営中',
          release: `${2023 + Math.floor(rng() * 3)}-${String(randRange(1, 12, rng)).padStart(2, '0')}`,
          genre: a.genre,
        }))
      : [{ name: `${name}の主力タイトル`, status: '運営中', release: '2024-06', genre }]

    // Add a developing title
    titles.push({
      name: `新規タイトル (${name})`,
      status: '開発中',
      release: '2026Q3予定',
      genre: genre,
    })

    const headcount = randRange(50, 1500, rng)

    return {
      id: `company-${i}`,
      name,
      listed: rng() > 0.3,
      ticker: rng() > 0.3 ? String(randRange(1000, 9999, rng)) : null,
      segment: segmentOptions[i % segmentOptions.length],
      headcount,
      headcount_trend: pick(trendOptions, rng),
      hiring_roles: (hiringPools[i] || hiringPools[0]).slice(0, randRange(0, 4, rng)),
      quarterly_financials,
      titles,
    }
  })

  return { source: '企業IR / 推定データ (generated)', companies }
}

function generateFundamentals(allApps, genre, rng) {
  const dates = generateWeeklyDates(26)

  // Match MarketFundamentalsView expected format: apps[].weekly_sales_rank
  const apps = allApps.slice(0, 3).map((app, ai) => {
    const baseRank = 10 + ai * 25 + randRange(0, 15, rng)
    return {
      id: app.id,
      name: app.name,
      weekly_sales_rank: dates.map((date, i) => {
        const seasonal = Math.sin((i / 26) * Math.PI * 2) * 12
        const noise = (rng() - 0.5) * 10
        return { date, rank: Math.max(1, Math.min(100, Math.round(baseRank - seasonal + noise))) }
      }),
    }
  })

  const months = generateMonthlyDates(6)
  const sns_buzz = {
    monthly: months.map(month => ({
      month,
      twitter_mentions: randRange(5000, 30000, rng),
      youtube_videos: randRange(50, 200, rng),
      streamer_count: randRange(20, 80, rng),
    })),
  }

  const exchange_rate = {
    pair: 'USD/JPY',
    weekly: dates.map((date, i) => ({
      date,
      rate: Math.round((148 + Math.sin(i / 8) * 5 + (rng() - 0.5) * 3) * 10) / 10,
    })),
  }

  const regulations = [
    { date: '2026-04-01', title: '景品表示法ガイドライン更新', region: 'JP', impact: 'neutral', detail: 'ゲーム内ガチャの「優良誤認」基準を明確化' },
    { date: '2026-03-10', title: 'Google Play ポリシー変更', region: 'Global', impact: 'negative', detail: 'リワード広告の表示制限強化。広告収益モデルへの影響' },
    { date: '2026-02-20', title: 'EU デジタル市場法 (DMA) 施行', region: 'EU', impact: 'neutral', detail: 'サイドローディング義務化によるストア手数料構造への影響を注視' },
    { date: '2026-01-15', title: '未成年課金上限規制強化', region: 'JP', impact: 'negative', detail: '18歳未満のアプリ内課金上限を月額5,000円に制限する改正案' },
  ]

  return { source: 'Market Fundamentals (generated)', apps, sns_buzz, exchange_rate, regulations }
}

function generateEvents(allApps, rng) {
  const types = ['ガチャ', 'コラボ', 'シーズン', 'キャンペーン', 'アップデート']
  const nameTemplates = {
    'ガチャ': ['限定キャラ ピックアップ', '新英雄ガチャ', '復刻祭ガチャ', '周年記念ガチャ'],
    'コラボ': ['人気アニメコラボ', 'YouTuberコラボ', '他ゲームコラボ', 'ブランドコラボ'],
    'シーズン': ['春の大感謝祭', 'シーズン更新', 'ランキングシーズン', 'エイプリルフール'],
    'キャンペーン': ['友達招待キャンペーン', '新規応援ログボ', 'カムバックCP', 'SNSフォローCP'],
    'アップデート': ['大型アップデート', '新モード追加', 'バランス調整', 'UI刷新'],
  }
  const sources = ['公式X', 'ストア更新', '公式サイト']

  const events = []
  const apps = allApps.slice(0, 4)

  for (const app of apps) {
    const count = randRange(2, 4, rng)
    for (let i = 0; i < count; i++) {
      const type = pick(types, rng)
      const startMonth = randRange(3, 4, rng)
      const startDay = randRange(1, 25, rng)
      const duration = type === 'アップデート' ? 0 : randRange(5, 21, rng)
      const start = new Date(`2026-${String(startMonth).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`)
      const end = duration > 0 ? new Date(start.getTime() + duration * 86400000) : null

      events.push({
        app: app.name,
        type,
        name: pick(nameTemplates[type], rng),
        start: start.toISOString().slice(0, 10),
        end: end ? end.toISOString().slice(0, 10) : null,
        source: pick(sources, rng),
      })
    }
  }

  events.sort((a, b) => b.start.localeCompare(a.start))
  return { source: 'Event Calendar (generated)', events, _apps: apps.map(a => a.name) }
}

function generateCausation(allApps, rng) {
  const layers = ['マクロ', '競合', 'ユーザー']
  const impacts = ['positive', 'negative', 'neutral']
  const eventTemplates = [
    { event: '大型アップデート', layer: 'ユーザー', impact: 'positive', memo: 'インストール数が翌週+30%' },
    { event: '競合アプリリリース', layer: '競合', impact: 'negative', memo: 'DAUが一時的に-15%低下' },
    { event: 'TVCMキャンペーン開始', layer: 'マクロ', impact: 'positive', memo: '認知度向上、新規流入+25%' },
    { event: 'サーバー障害発生', layer: 'ユーザー', impact: 'negative', memo: 'レビュースコアが0.3pt低下' },
    { event: '周年記念イベント', layer: 'ユーザー', impact: 'positive', memo: '課金率が前月比+40%' },
    { event: '為替変動 (円安)', layer: 'マクロ', impact: 'neutral', memo: '海外売上の円換算が増加' },
    { event: '競合が大型セール実施', layer: '競合', impact: 'negative', memo: '競合へのユーザー流出の兆候' },
    { event: '新キャラクター追加', layer: 'ユーザー', impact: 'positive', memo: 'ガチャ売上が2倍に' },
  ]

  const notes = eventTemplates.slice(0, 6).map((tpl, i) => {
    const day = randRange(1, 28, rng)
    const month = randRange(1, 3, rng)
    return {
      id: `note_${i + 1}`,
      date: `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      event: tpl.event,
      app: allApps[Math.floor(rng() * Math.min(allApps.length, 3))].name,
      layer: tpl.layer,
      impact: tpl.impact,
      memo: tpl.memo,
    }
  })

  notes.sort((a, b) => b.date.localeCompare(a.date))
  return { source: 'Causation Notes (generated)', notes }
}

function generateIndustry(genre, genreInfo, rng) {
  const trendOptions = ['rising', 'stable', 'falling']
  const news = [
    { date: '2026-04-08', title: `【4Gamer】2026年Q1モバイルゲーム市場レポート: ${genre}ジャンルが前年比+12%`, source: '4Gamer', url: null, tags: ['市場動向', genre] },
    { date: '2026-04-07', title: '【GameBiz】海外スタジオの日本参入が加速', source: 'GameBiz', url: null, tags: ['競合', genre] },
    { date: '2026-04-05', title: '【ファミ通】App Store / Google Playの3月売上ランキングまとめ', source: 'ファミ通', url: null, tags: ['ランキング'] },
    { date: '2026-04-03', title: '【GameBiz】Unity 2026 Gaming Report: CPI前年比上昇', source: 'GameBiz', url: null, tags: ['CPI', genre] },
    { date: '2026-04-01', title: `【4Gamer】Apple、開発者向け手数料体系を見直しへ`, source: '4Gamer', url: null, tags: ['規制', 'Apple'] },
    { date: '2026-03-28', title: `【Social Game Info】${genre}カテゴリでランキング変動`, source: 'Social Game Info', url: null, tags: ['ランキング', genre] },
  ]

  const genres = Object.keys(GENRE_POOL).slice(0, 5)

  const benchmarks = {
    source: 'Unity Gaming Report 2026 / 無料公開レポート',
    cpi_by_genre: {
      period: '2025Q4',
      currency: 'USD',
      data: genres.map(g => ({
        genre: g,
        ios: Math.round((1.5 + rng() * 5.5) * 100) / 100,
        android: Math.round((0.8 + rng() * 4.0) * 100) / 100,
        trend: pick(trendOptions, rng),
      })),
    },
    retention_by_genre: {
      period: '2025Q4',
      data: genres.map(g => ({
        genre: g,
        d1: Math.round(25 + rng() * 20),
        d7: Math.round(8 + rng() * 15),
        d30: Math.round(2 + rng() * 10),
      })),
    },
    market_size: {
      jp_mobile_game_2025: '1.8兆円',
      yoy_growth: '+4.2%',
      top_genre_share: [
        ...genres.map(g => ({ genre: g, share: Math.round(8 + rng() * 25) })),
        { genre: 'その他', share: 18 },
      ],
    },
  }

  return { source: 'Industry Data (generated)', news, benchmarks }
}

export function getAvailableGenres() {
  return Object.keys(GENRE_POOL)
}
