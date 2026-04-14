/**
 * Generate contextual mock data based on user input (app name, company, genre).
 * When real APIs are connected (Phase 2), this will be replaced by actual data collection.
 */

const MAX_MOCK_COMPETITORS = 8

const GENRE_POOL = {
  'パズル': {
    keywords: ['パズルゲーム', 'マッチ3', 'ブロックパズル', '脳トレ'],
    competitors: ['パズル&ドラゴンズ', 'ツムツム', 'キャンディクラッシュ', 'トゥーンブラスト', 'ガーデンスケイプ', 'ホームスケイプ', 'ぷよぷよ', 'LINE POP2'],
    companies: ['ガンホー', 'LINE', 'King', 'Peak Games', 'Playrix', 'Playrix', 'SEGA', 'LINE'],
    complaints: ['広告が多すぎる', '難易度が急に上がる', '読み込みが遅い', 'スタミナ制限がきつい'],
    praises: ['パズルが面白い', '暇つぶしに最適', 'グラフィックきれい', '無課金でも楽しめる'],
    hooks: ['「このレベル、誰でも解けます」系', 'ビフォーアフター系', '失敗系リアクション', 'ASMR系'],
  },
  'RPG': {
    keywords: ['RPGスマホ', 'ガチャゲー', 'ターン制RPG', 'アクションRPG'],
    competitors: ['原神', 'FGO', 'ウマ娘', 'ブルーアーカイブ', '放置少女', 'AFK Journey', 'ヘブンバーンズレッド', 'グランブルーファンタジー'],
    companies: ['miHoYo', 'アニプレックス', 'Cygames', 'Yostar', 'C4 Connect', 'Lilith Games', 'WFS', 'Cygames'],
    complaints: ['ガチャ確率が低い', 'スタミナ消費が早い', 'PvPバランスが悪い', 'インフレが激しい'],
    praises: ['ストーリーが面白い', 'キャラデザが良い', 'イベントが充実', 'BGMが素晴らしい'],
    hooks: ['キャラクター紹介系', 'コラボ告知系', '最強編成紹介系', 'ストーリー訴求系'],
  },
  'カジュアル': {
    keywords: ['カジュアルゲーム', '暇つぶしゲーム', 'ハイパーカジュアル', 'ミニゲーム'],
    competitors: ['Among Us', 'Subway Surfers', '2048', 'Flappy Bird系', 'Crossy Road', 'ヘビ.io', 'フィッシュダム', 'ロイヤルマッチ'],
    companies: ['Voodoo', 'Ketchapp', 'SayGames', 'Lion Studios', 'Hipster Whale', 'Kooapps', 'Playrix', 'Dream Games'],
    complaints: ['すぐ飽きる', '課金圧が強い', 'バグが多い', '広告がうざい'],
    praises: ['操作が簡単', 'サクッと遊べる', '無料で十分楽しめる', 'テンポが良い'],
    hooks: ['失敗系リアクション', 'UGC風ナチュラル系', '「暇なときにどうぞ」系', 'スコアチャレンジ系'],
  },
  'ストラテジー': {
    keywords: ['ストラテジー', '戦略ゲーム', 'タワーディフェンス', '城ゲー'],
    competitors: ['クラロワ', 'Rise of Kingdoms', 'アークナイツ', 'ドミネーションズ', '三國志 真戦', 'Lords Mobile', 'マフィアシティ', 'エボニー'],
    companies: ['Supercell', 'Lilith Games', 'Yostar', 'Nexon', 'Qookka Games', 'IGG', 'YOTTA Games', 'TG Inc.'],
    complaints: ['課金者が強すぎる', 'マッチングが不公平', 'アプデが遅い', 'UIが分かりにくい'],
    praises: ['戦略性が高い', 'やりこみ要素が豊富', 'ギルドが楽しい', 'グラフィックが綺麗'],
    hooks: ['「無課金でも最強」系', 'ランキング訴求系', '攻略紹介系', 'PvPハイライト系'],
  },
  'アクション': {
    keywords: ['アクションゲーム', 'バトルロイヤル', 'シューティング', '格闘ゲーム'],
    competitors: ['PUBG Mobile', '荒野行動', 'Brawl Stars', 'シャドウファイト', '鉄拳', 'Apex Legends Mobile', 'Call of Duty Mobile', 'フォートナイト'],
    companies: ['Krafton', 'NetEase', 'Supercell', 'Nekki', 'BANDAI NAMCO', 'EA', 'Activision', 'Epic Games'],
    complaints: ['ラグがひどい', 'チーターが多い', 'マッチング遅い', '容量が大きい'],
    praises: ['操作感が良い', 'グラフィックが最高', '友達と遊べる', 'eスポーツが熱い'],
    hooks: ['ハイライトプレイ系', 'eスポーツ訴求系', '新シーズン告知系', 'コラボ系'],
  },
  'シミュレーション': {
    keywords: ['シミュレーション', '経営ゲーム', '育成ゲーム', '箱庭ゲーム'],
    competitors: ['どうぶつの森', 'シムシティ', 'スタデューバレー', 'ポケモンGO', 'ヘイ・デイ', 'クッキーラン', 'タウンシップ', 'マージマンション'],
    companies: ['Nintendo', 'EA', 'ConcernedApe', 'Niantic', 'Supercell', 'Devsisters', 'Playrix', 'Metacore'],
    complaints: ['コンテンツ不足', '課金要素が多い', '進行が遅い', 'イベントが単調'],
    praises: ['まったり遊べる', '自由度が高い', '癒やされる', 'コレクション要素が楽しい'],
    hooks: ['ビフォーアフター系', '建設タイムラプス系', 'コレクション紹介系', '癒やし系'],
  },
}

// ─── インフルエンサー向けカテゴリプール ─────────────────
const INFLUENCER_POOL = {
  'エンタメ': {
    keywords: ['YouTuber', 'エンタメ動画', 'おもしろ動画', 'バラエティ'],
    competitors: ['HIKAKIN', 'はじめしゃちょー', 'ヒカル', 'コムドット'],
    companies: ['UUUM', 'GROVE', 'Kiii', 'VAZ'],
    complaints: ['最近つまらない', 'ネタ切れ感がある', '広告が多い', '企業案件ばかり'],
    praises: ['テンポが良い', '編集が上手い', '毎日更新ありがたい', '裏表がなくて好き'],
    hooks: ['ドッキリ系', '大金企画系', '24時間チャレンジ', 'コラボ系'],
  },
  'ゲーム実況': {
    keywords: ['ゲーム実況', 'ゲーム配信', 'Vtuber', 'eスポーツ'],
    competitors: ['キヨ', '兄者弟者', 'ポッキー', '赤髪のとも'],
    companies: ['UUUM', 'hololive', 'にじさんじ', 'GameWith'],
    complaints: ['同じゲームばかり', '配信が長すぎる', 'サムネが釣り', 'ネタバレが多い'],
    praises: ['リアクションが面白い', 'トークが上手い', '視聴者参加型が楽しい', 'BGMが良い'],
    hooks: ['初見プレイ系', 'ランキング実況', 'コラボ配信', '最速クリア系'],
  },
  '教育・ビジネス': {
    keywords: ['ビジネス系YouTuber', '教育系', '自己啓発', 'マネーリテラシー'],
    competitors: ['中田敦彦', '両学長', 'マコなり社長', 'サラタメ'],
    companies: ['PROGRESS', '個人運営', 'リベ大', 'マネーフォワード'],
    complaints: ['表面的すぎる', '結論が遅い', '自慢話が多い', '情報が古い'],
    praises: ['分かりやすい', '勉強になる', 'テンポが良い', '通勤中に聴ける'],
    hooks: ['要約系', 'ランキング系', '失敗談系', '具体的How-to系'],
  },
  '美容・ファッション': {
    keywords: ['美容系YouTuber', 'コスメレビュー', 'メイク動画', 'ファッション'],
    competitors: ['関根りさ', '会社員J', 'nanakoななこ', '水越みさと'],
    companies: ['GROVE', 'C Channel', 'TWIN PLANET', 'PPP STUDIO'],
    complaints: ['PR多すぎ', '高い商品ばかり', '肌が違うと参考にならない', '案件と分かりにくい'],
    praises: ['正直レビューが信頼できる', 'プチプラ紹介が嬉しい', '比較が分かりやすい', '垢抜けた'],
    hooks: ['ビフォーアフター系', '○○円以下縛り', '毎日メイク紹介', '殿堂入りコスメ系'],
  },
  '料理・グルメ': {
    keywords: ['料理系YouTuber', 'レシピ動画', 'グルメ', 'ASMR料理'],
    competitors: ['リュウジ', '料理研究家ゆかり', 'きまぐれクック', 'Genの炊事場'],
    companies: ['個人運営', 'tastemade', 'DELISH KITCHEN', 'kurashiru'],
    complaints: ['材料が手に入りにくい', '味付けが濃い', '工程が多い', '洗い物が増える'],
    praises: ['簡単で美味しい', '手順が分かりやすい', 'ASMR心地良い', '節約レシピ助かる'],
    hooks: ['時短レシピ系', '100均グッズ活用', '大食い系', '再現料理系'],
  },
  'テック・ガジェット': {
    keywords: ['ガジェット系YouTuber', 'スマホレビュー', 'PC', 'テック'],
    competitors: ['瀬戸弘司', 'カズチャンネル', 'トバログ', 'Appleが大好きなんだよ'],
    companies: ['UUUM', '個人運営', 'ガジェット通信', 'Engadget JP'],
    complaints: ['Apple贔屓', '高い商品ばかり', '提供品のレビューは信用できない', 'スペック読み上げるだけ'],
    praises: ['比較が詳しい', '実際に使ってるのが分かる', 'デメリットも言ってくれる', '長期レビューが嬉しい'],
    hooks: ['開封系', 'vs比較系', '○万円で揃える', 'ベストバイ系'],
  },
  'Vlog・ライフスタイル': {
    keywords: ['Vlog', 'ライフスタイル', 'ルーティン', 'ミニマリスト'],
    competitors: ['Nami Channel', 'ondo', 'in living.', 'SUB'],
    companies: ['個人運営', 'GROVE', 'BitStar', 'CHOCOLAT'],
    complaints: ['映像は綺麗だけど内容が薄い', '生活感がない', 'BGMがうるさい', '毎回同じパターン'],
    praises: ['映像が美しい', '癒される', '丁寧な暮らしに憧れる', 'モチベーションが上がる'],
    hooks: ['モーニングルーティン', '購入品紹介', 'ルームツアー', '休日Vlog'],
  },
  '音楽': {
    keywords: ['歌ってみた', '弾いてみた', 'Music', 'カバー曲'],
    competitors: ['THE FIRST TAKE', 'Goose house', 'コバソロ', 'Rainych'],
    companies: ['Sony Music', 'UUUM', '個人運営', 'CulTV'],
    complaints: ['音質が悪い', '選曲が偏っている', 'オリジナル曲が少ない', 'MV風で内容がない'],
    praises: ['歌が上手い', '原曲より好き', 'アレンジが素敵', 'ライブが最高'],
    hooks: ['一発撮り系', 'ストリート演奏', 'マッシュアップ', 'リクエスト企画'],
  },
  'スポーツ・フィットネス': {
    keywords: ['筋トレ', 'フィットネス', 'ダイエット', 'スポーツ'],
    competitors: ['なかやまきんに君', 'のがちゃんねる', 'メトロンブログ', 'Marina Takewaki'],
    companies: ['UUUM', '個人運営', 'LEAN BODY', 'RIZAP'],
    complaints: ['キツすぎる', '初心者向けじゃない', 'サプリ推しがうざい', '効果が出ない'],
    praises: ['一緒にやると続く', '説明が分かりやすい', '楽しくて汗かける', '結果が出た'],
    hooks: ['○日チャレンジ', 'ビフォーアフター', '○分で完結', '食事管理系'],
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
  const now = new Date()
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i * 7)
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}

function generateMonthlyDates(months = 6) {
  const dates = []
  const base = new Date()
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(base)
    d.setMonth(d.getMonth() - i)
    dates.push(d.toISOString().slice(0, 7))
  }
  return dates
}

export function generateCompetitorData(target) {
  const { appName, companyName, genre } = target
  const genreInfo = GENRE_POOL[genre] || INFLUENCER_POOL[genre] || GENRE_POOL[DEFAULT_GENRE]
  const rng = seededRandom(appName + companyName + genre)

  // Pick up to MAX_MOCK_COMPETITORS competitors
  const competitorApps = genreInfo.competitors.slice(0, MAX_MOCK_COMPETITORS)
  const competitorCompanies = genreInfo.companies.slice(0, MAX_MOCK_COMPETITORS)

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
  const isInfluencer = genre in INFLUENCER_POOL
  const pool = isInfluencer ? INFLUENCER_POOL : GENRE_POOL
  const genres = [genre, ...Object.keys(pool).filter(g => g !== genre).slice(0, 4)]
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

function generateReviews(allApps, genreInfo, rng) {
  const months = generateMonthlyDates(6)

  const apps = allApps.map(app => {
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

  return { source: 'App Store / Google Play (generated)', apps, collected_at: new Date().toISOString() }
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
  const apps = allApps.map((app, ai) => {
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

  return { source: 'Market Fundamentals (generated)', apps, sns_buzz }
}

function generateEvents(allApps, rng) {
  const influencer = allApps[0]?.genre in INFLUENCER_POOL
  const types = influencer
    ? ['コラボ', '企画', 'ライブ配信', '案件', 'チャンネル変更']
    : ['ガチャ', 'コラボ', 'シーズン', 'キャンペーン', 'アップデート']
  const nameTemplates = influencer
    ? {
        'コラボ': ['人気クリエイターコラボ', '企業タイアップコラボ', '異ジャンルコラボ', 'コラボライブ'],
        '企画': ['100万人記念企画', '視聴者参加型企画', '大型検証企画', '○○やってみた'],
        'ライブ配信': ['プレミア公開', '生配信イベント', 'Q&Aライブ', '記念ライブ'],
        '案件': ['新商品タイアップ', 'ブランドPR', 'アプリ紹介案件', 'サービス紹介'],
        'チャンネル変更': ['サムネイル刷新', '投稿頻度変更', '新シリーズ開始', 'チャンネル名変更'],
      }
    : {
        'ガチャ': ['限定キャラ ピックアップ', '新英雄ガチャ', '復刻祭ガチャ', '周年記念ガチャ'],
        'コラボ': ['人気アニメコラボ', 'YouTuberコラボ', '他ゲームコラボ', 'ブランドコラボ'],
        'シーズン': ['春の大感謝祭', 'シーズン更新', 'ランキングシーズン', 'エイプリルフール'],
        'キャンペーン': ['友達招待キャンペーン', '新規応援ログボ', 'カムバックCP', 'SNSフォローCP'],
        'アップデート': ['大型アップデート', '新モード追加', 'バランス調整', 'UI刷新'],
      }
  const sources = influencer
    ? ['YouTube', 'X/Twitter', 'Instagram', 'TikTok']
    : ['公式X', 'ストア更新', '公式サイト']

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
  const influencer = allApps[0]?.genre in INFLUENCER_POOL
  const eventTemplates = influencer
    ? [
        { event: 'バズ動画が出た', layer: 'ユーザー', impact: 'positive', memo: '再生数が通常の5倍、登録者+2万' },
        { event: '競合クリエイターが同テーマ投稿', layer: '競合', impact: 'negative', memo: '自分の動画のインプレッションが-20%' },
        { event: 'ジャンルトレンドが急上昇', layer: 'マクロ', impact: 'positive', memo: '検索流入が+40%、新規視聴者増' },
        { event: 'コメント欄が炎上', layer: 'ユーザー', impact: 'negative', memo: '高評価率が70%→55%に低下' },
        { event: '企業タイアップ動画を投稿', layer: 'ユーザー', impact: 'neutral', memo: '再生数は通常の0.8倍だが収益は3倍' },
        { event: 'YouTube アルゴリズム変更', layer: 'マクロ', impact: 'negative', memo: 'ショート動画の表示頻度が低下' },
        { event: '競合がチャンネル休止を発表', layer: '競合', impact: 'positive', memo: '同ジャンルの視聴者が流入' },
        { event: '投稿頻度を週3→週5に変更', layer: 'ユーザー', impact: 'positive', memo: '月間再生数が+60%増加' },
      ]
    : [
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
  const influencer = genre in INFLUENCER_POOL
  const trendOptions = ['rising', 'stable', 'falling']

  const news = influencer
    ? [
        { date: '2026-04-08', title: `【CREATORS STATION】2026年Q1 ${genre}系クリエイター市場レポート: 登録者成長率+15%`, source: 'CREATORS STATION', url: null, tags: ['市場動向', genre] },
        { date: '2026-04-07', title: '【yutura】YouTubeショート動画の収益化ルールが改定', source: 'yutura', url: null, tags: ['プラットフォーム', 'YouTube'] },
        { date: '2026-04-05', title: '【Social Blade】日本のYouTubeチャンネル登録者ランキング3月まとめ', source: 'Social Blade', url: null, tags: ['ランキング'] },
        { date: '2026-04-03', title: '【CREATORS STATION】TikTok Creator Fund 報酬単価の推移分析', source: 'CREATORS STATION', url: null, tags: ['収益化', 'TikTok'] },
        { date: '2026-04-01', title: '【yutura】Instagram Reels のアルゴリズム変更、リーチに影響', source: 'yutura', url: null, tags: ['アルゴリズム', 'Instagram'] },
        { date: '2026-03-28', title: `【CREATORS STATION】${genre}カテゴリで新規チャンネルが急増`, source: 'CREATORS STATION', url: null, tags: ['競合', genre] },
      ]
    : [
        { date: '2026-04-08', title: `【4Gamer】2026年Q1モバイルゲーム市場レポート: ${genre}ジャンルが前年比+12%`, source: '4Gamer', url: null, tags: ['市場動向', genre] },
        { date: '2026-04-07', title: '【GameBiz】海外スタジオの日本参入が加速', source: 'GameBiz', url: null, tags: ['競合', genre] },
        { date: '2026-04-05', title: '【ファミ通】App Store / Google Playの3月売上ランキングまとめ', source: 'ファミ通', url: null, tags: ['ランキング'] },
        { date: '2026-04-03', title: '【GameBiz】Unity 2026 Gaming Report: CPI前年比上昇', source: 'GameBiz', url: null, tags: ['CPI', genre] },
        { date: '2026-04-01', title: `【4Gamer】Apple、開発者向け手数料体系を見直しへ`, source: '4Gamer', url: null, tags: ['規制', 'Apple'] },
        { date: '2026-03-28', title: `【Social Game Info】${genre}カテゴリでランキング変動`, source: 'Social Game Info', url: null, tags: ['ランキング', genre] },
      ]

  const pool = influencer ? INFLUENCER_POOL : GENRE_POOL
  const genres = Object.keys(pool).slice(0, 5)

  const benchmarks = influencer
    ? {
        source: 'Social Blade / CREATORS STATION / 推定データ',
        cpi_by_genre: {
          period: '2025Q4',
          currency: '円/登録者',
          data: genres.map(g => ({
            genre: g,
            ios: Math.round((5 + rng() * 30) * 10) / 10,
            android: Math.round((3 + rng() * 20) * 10) / 10,
            trend: pick(trendOptions, rng),
          })),
        },
        retention_by_genre: {
          period: '2025Q4',
          data: genres.map(g => ({
            genre: g,
            d1: Math.round(30 + rng() * 25),
            d7: Math.round(15 + rng() * 20),
            d30: Math.round(5 + rng() * 15),
          })),
        },
        market_size: {
          jp_mobile_game_2025: '5,800億円',
          yoy_growth: '+18.5%',
          top_genre_share: [
            ...genres.map(g => ({ genre: g, share: Math.round(5 + rng() * 20) })),
            { genre: 'その他', share: 15 },
          ],
        },
      }
    : {
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

  return { source: influencer ? 'Creator Economy Data (generated)' : 'Industry Data (generated)', news, benchmarks }
}

export function getAvailableGenres() {
  return Object.keys(GENRE_POOL)
}

export function getInfluencerCategories() {
  return Object.keys(INFLUENCER_POOL)
}
