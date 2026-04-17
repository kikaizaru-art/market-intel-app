/**
 * 共有定数 — カラーパレット、ラベル、設定値
 */

// 汎用カラーパレット (11色 — メイン + 最大10競合)
export const PALETTE = [
  '#388bfd', '#d2a8ff', '#56d364', '#e3b341', '#79c0ff',
  '#f0883e', '#f778ba', '#a5d6ff', '#7ee787', '#ffa657', '#cda4de',
]

export const ACCENT_ORANGE = '#f0883e'

// イベントタイプ
export const TYPE_COLORS = {
  'ガチャ': '#d2a8ff', 'コラボ': '#f0883e', 'シーズン': '#56d364',
  'キャンペーン': '#388bfd', 'アップデート': '#8b949e',
  // インフルエンサー向け
  '企画': '#d2a8ff', 'ライブ配信': '#56d364', '案件': '#e3b341',
  'チャンネル変更': '#8b949e',
}

// ステータス
export const STATUS_COLORS = { '運営中': '#56d364', '開発中': '#388bfd' }

// トレンド方向
export const TREND_LABELS = { rising: '上昇', falling: '下降', stable: '横ばい' }
export const TREND_ICONS = { rising: '▲', falling: '▼', stable: '→' }
export const TREND_COLORS = { rising: '#56d364', falling: '#f85149', stable: '#e3b341' }
export const CPI_TREND_COLORS = { rising: '#f85149', falling: '#56d364', stable: '#e3b341' }

// インパクト
export const IMPACT_LABELS = { positive: '好影響', negative: '悪影響', neutral: '中立' }
export const IMPACT_COLORS = { positive: '#56d364', negative: '#f85149', neutral: '#e3b341' }

// レイヤー
export const LAYER_COLORS = { 'マクロ': '#388bfd', '競合': '#f85149', 'ユーザー': '#56d364' }

// 人員動向
export const HEADCOUNT_TREND_LABELS = { increasing: '増員中', stable: '横ばい', decreasing: '減員中' }
export const HEADCOUNT_TREND_COLORS = { increasing: '#56d364', stable: '#e3b341', decreasing: '#f85149' }

// ジャンル（業界ベンチマーク用 — デフォルト/フォールバック）
// ドメイン固有のジャンル色は domain config の `genreColors` で上書き可能。
// 未登録ジャンルは PALETTE から順に割り当てる (makeGenreColors)。
export const GENRE_COLORS = {
  'パズル': '#388bfd', 'RPG': '#d2a8ff', 'カジュアル': '#56d364',
  'ストラテジー': '#e3b341', 'スポーツ': '#79c0ff', 'アクション': '#f85149',
  'シミュレーション': '#f0883e', 'その他': '#484f58',
}

/**
 * ジャンル → 色のマップをドメインに合わせて生成
 * @param {string[]} genres  順序を保って色を割り当てるジャンル配列
 * @param {object}   overrides  ドメイン config の `genreColors` (任意)
 */
export function makeGenreColors(genres = [], overrides = {}) {
  const map = {}
  genres.forEach((g, i) => {
    map[g] = overrides[g] || GENRE_COLORS[g] || PALETTE[i % PALETTE.length]
  })
  return map
}

// 自動メモ パターンタイプ
export const PATTERN_TYPE_LABELS = {
  anomaly_event:    '異常値×イベント',
  trend_shift:      'トレンド変動',
  review_spike:     'レビュー急変',
  news_correlation: 'ニュース相関',
  seasonal:         '季節パターン',
}
export const PATTERN_TYPE_COLORS = {
  anomaly_event:    '#f85149',
  trend_shift:      '#388bfd',
  review_spike:     '#d2a8ff',
  news_correlation: '#79c0ff',
  seasonal:         '#e3b341',
}

// 自動メモ ステータス
export const AUTO_STATUS_LABELS = { pending: '未確認', confirmed: '承認済', rejected: '却下' }
export const AUTO_STATUS_COLORS = { pending: '#e3b341', confirmed: '#56d364', rejected: '#f85149' }

// 施策レーン (ゲームドメイン等で「企画側」と「広告運用側」を分離)
export const LANE_LABELS = { product: 'プロダクト', marketing: 'マーケ' }
export const LANE_COLORS = { product: '#d2a8ff', marketing: '#f0883e' }

// 広告/プロモ媒体 — 主にマーケ施策で使用 (施策記録に複数タグ付け可能)
export const MEDIA_OPTIONS = [
  { key: 'meta',     label: 'Meta' },
  { key: 'google',   label: 'Google Ads' },
  { key: 'asa',      label: 'Apple Search' },
  { key: 'x',        label: 'X' },
  { key: 'tiktok',   label: 'TikTok' },
  { key: 'unity',    label: 'Unity' },
  { key: 'applovin', label: 'AppLovin' },
  { key: 'youtube',  label: 'YouTube' },
  { key: 'influencer', label: 'インフル' },
  { key: 'tvcm',     label: 'TVCM' },
  { key: 'other',    label: 'その他' },
]

// 地域/国 — 全レーン共通タグ (グローバル配信時の差分を見る)
export const REGION_OPTIONS = [
  { key: 'jp',     label: '日本' },
  { key: 'us',     label: '米国' },
  { key: 'asia',   label: 'アジア' },
  { key: 'eu',     label: '欧州' },
  { key: 'global', label: 'グローバル' },
]

// クイックイベント入力 — ドメイン別プリセット
// game-market は「プロダクト」(企画/開発) と「マーケ」(広告運用) の2レーンで記録
export const QUICK_EVENT_PRESETS = {
  'game-market': [
    // ─── プロダクト (企画/開発側) ───
    { key: 'update',       label: 'アプデ配信',    icon: '📦', lane: 'product',   layer: 'ユーザー', impact: 'neutral'  },
    { key: 'gacha',        label: 'ガチャ開催',    icon: '🎰', lane: 'product',   layer: 'ユーザー', impact: 'positive' },
    { key: 'event_start',  label: 'イベント開始',  icon: '🎉', lane: 'product',   layer: 'ユーザー', impact: 'positive' },
    { key: 'event_end',    label: 'イベント終了',  icon: '🏁', lane: 'product',   layer: 'ユーザー', impact: 'neutral'  },
    { key: 'collab',       label: 'コラボ開始',    icon: '🤝', lane: 'product',   layer: '競合',     impact: 'positive' },
    { key: 'season',       label: 'シーズン更新',  icon: '🗓', lane: 'product',   layer: 'ユーザー', impact: 'positive' },
    { key: 'bug',          label: '不具合発生',    icon: '🐛', lane: 'product',   layer: 'ユーザー', impact: 'negative' },
    { key: 'hotfix',       label: '修正リリース',  icon: '🛠', lane: 'product',   layer: 'ユーザー', impact: 'positive' },
    { key: 'store_update', label: 'ストアページ更新', icon: '🏬', lane: 'product', layer: '競合',   impact: 'neutral'  },
    // ─── マーケ (広告運用側) ───
    { key: 'creative_swap', label: 'クリエ差替',    icon: '🎨', lane: 'marketing', layer: 'マクロ',   impact: 'neutral'  },
    { key: 'budget_up',    label: '予算増額',      icon: '💸', lane: 'marketing', layer: 'マクロ',   impact: 'neutral'  },
    { key: 'budget_down',  label: '予算減額',      icon: '📉', lane: 'marketing', layer: 'マクロ',   impact: 'neutral'  },
    { key: 'new_media',    label: '新媒体投入',    icon: '🆕', lane: 'marketing', layer: 'マクロ',   impact: 'neutral'  },
    { key: 'media_pause',  label: '媒体停止',      icon: '⏸', lane: 'marketing', layer: 'マクロ',   impact: 'neutral'  },
    { key: 'promo_start',  label: 'プロモ開始',    icon: '🎁', lane: 'marketing', layer: 'マクロ',   impact: 'positive' },
    { key: 'promo_end',    label: 'プロモ終了',    icon: '🔚', lane: 'marketing', layer: 'マクロ',   impact: 'neutral'  },
    { key: 'lp_change',    label: 'LP変更',        icon: '📝', lane: 'marketing', layer: 'マクロ',   impact: 'neutral'  },
    { key: 'influencer',   label: 'インフル起用',  icon: '📢', lane: 'marketing', layer: 'マクロ',   impact: 'positive' },
  ],
  'influencer': [
    { key: 'video',     label: '動画投稿',      icon: '🎬', lane: 'product',   layer: 'ユーザー',  impact: 'positive' },
    { key: 'live',      label: 'ライブ配信',    icon: '📡', lane: 'product',   layer: 'ユーザー',  impact: 'positive' },
    { key: 'sponsor',   label: '案件開始',      icon: '💰', lane: 'marketing', layer: 'マクロ',    impact: 'neutral' },
    { key: 'collab',    label: 'コラボ企画',    icon: '🤝', lane: 'product',   layer: '競合',      impact: 'positive' },
    { key: 'ch_change', label: 'チャンネル変更', icon: '⚙',  lane: 'product',   layer: 'ユーザー',  impact: 'neutral' },
    { key: 'trend',     label: 'トレンド乗り',  icon: '🔥', lane: 'marketing', layer: 'マクロ',    impact: 'positive' },
  ],
  'stock': [
    { key: 'earnings',  label: '決算発表',      icon: '📊', lane: 'product', layer: '競合',      impact: 'neutral' },
    { key: 'guidance',  label: '業績修正',      icon: '📈', lane: 'product', layer: '競合',      impact: 'neutral' },
    { key: 'buyback',   label: '自社株買い',    icon: '💹', lane: 'product', layer: '競合',      impact: 'positive' },
    { key: 'dividend',  label: '増配/減配',     icon: '💰', lane: 'product', layer: '競合',      impact: 'neutral' },
    { key: 'ma',        label: 'M&A/提携',      icon: '🤝', lane: 'product', layer: 'マクロ',    impact: 'neutral' },
    { key: 'regulation',label: '規制/政策',      icon: '📜', lane: 'product', layer: 'マクロ',    impact: 'negative' },
  ],
  'keiba': [
    { key: 'race',      label: 'レース結果',    icon: '🏇', lane: 'product', layer: '競合',      impact: 'neutral' },
    { key: 'training',  label: '調教情報',      icon: '🏋', lane: 'product', layer: '競合',      impact: 'neutral' },
    { key: 'jockey',    label: '騎手変更',      icon: '👤', lane: 'product', layer: '競合',      impact: 'neutral' },
    { key: 'track',     label: '馬場状態',      icon: '🌧', lane: 'product', layer: 'マクロ',    impact: 'neutral' },
    { key: 'draw',      label: '枠順確定',      icon: '🎯', lane: 'product', layer: '競合',      impact: 'neutral' },
    { key: 'odds',      label: 'オッズ変動',    icon: '📉', lane: 'product', layer: 'ユーザー',  impact: 'neutral' },
  ],
  '_default': [
    { key: 'action',    label: '施策実行',      icon: '▶',  lane: 'product',   layer: 'ユーザー',  impact: 'neutral' },
    { key: 'external',  label: '外部イベント',  icon: '🌐', lane: 'product',   layer: 'マクロ',    impact: 'neutral' },
    { key: 'competitor',label: '競合の動き',     icon: '👁',  lane: 'product',   layer: '競合',      impact: 'neutral' },
    { key: 'issue',     label: '不具合/問題',    icon: '⚠',  lane: 'product',   layer: 'ユーザー',  impact: 'negative' },
    { key: 'positive',  label: '好材料',        icon: '✨', lane: 'product',   layer: 'マクロ',    impact: 'positive' },
    { key: 'negative',  label: '悪材料',        icon: '💥', lane: 'product',   layer: 'マクロ',    impact: 'negative' },
  ],
}

// ニュースタグ
export const TAG_COLORS = {
  '市場動向': '#388bfd', 'RPG': '#d2a8ff', '競合': '#f85149',
  'ストラテジー': '#e3b341', 'ランキング': '#79c0ff', '規制': '#f0883e',
  'Apple': '#8b949e', 'CPI': '#f85149', 'カジュアル': '#56d364',
  'Google': '#56d364', 'パズル': '#388bfd', '事前登録': '#d2a8ff', '決算': '#e3b341',
  '広告': '#f0883e', '海外展開': '#79c0ff', 'ストア': '#8b949e',
  'アクション': '#f85149', 'シミュレーション': '#f0883e',
  // インフルエンサー向けタグ
  'プラットフォーム': '#388bfd', 'YouTube': '#f85149', 'TikTok': '#e6edf3',
  'Instagram': '#d2a8ff', '収益化': '#56d364', 'アルゴリズム': '#e3b341',
  'エンタメ': '#f0883e', 'ゲーム実況': '#d2a8ff', '教育・ビジネス': '#388bfd',
  '美容・ファッション': '#f85149', '料理・グルメ': '#56d364',
  'テック・ガジェット': '#79c0ff', 'Vlog・ライフスタイル': '#e3b341',
}
