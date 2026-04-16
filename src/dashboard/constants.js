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

// ジャンル（業界ベンチマーク用）
export const GENRE_COLORS = {
  'パズル': '#388bfd', 'RPG': '#d2a8ff', 'カジュアル': '#56d364',
  'ストラテジー': '#e3b341', 'スポーツ': '#79c0ff', 'アクション': '#f85149',
  'シミュレーション': '#f0883e', 'その他': '#484f58',
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

// クイックイベント入力 — ドメイン別プリセット
export const QUICK_EVENT_PRESETS = {
  'game-market': [
    { key: 'update',    label: 'アプデ出した',  icon: '📦', layer: 'ユーザー',  impact: 'neutral' },
    { key: 'gacha',     label: 'ガチャ開催',    icon: '🎰', layer: 'ユーザー',  impact: 'positive' },
    { key: 'collab',    label: 'コラボ開始',    icon: '🤝', layer: '競合',      impact: 'positive' },
    { key: 'campaign',  label: 'キャンペーン',  icon: '🎁', layer: 'ユーザー',  impact: 'positive' },
    { key: 'bug',       label: '不具合発生',    icon: '🐛', layer: 'ユーザー',  impact: 'negative' },
    { key: 'ad_change', label: '広告変更',      icon: '📢', layer: 'マクロ',    impact: 'neutral' },
  ],
  'influencer': [
    { key: 'video',     label: '動画投稿',      icon: '🎬', layer: 'ユーザー',  impact: 'positive' },
    { key: 'live',      label: 'ライブ配信',    icon: '📡', layer: 'ユーザー',  impact: 'positive' },
    { key: 'sponsor',   label: '案件開始',      icon: '💰', layer: 'マクロ',    impact: 'neutral' },
    { key: 'collab',    label: 'コラボ企画',    icon: '🤝', layer: '競合',      impact: 'positive' },
    { key: 'ch_change', label: 'チャンネル変更', icon: '⚙',  layer: 'ユーザー',  impact: 'neutral' },
    { key: 'trend',     label: 'トレンド乗り',  icon: '🔥', layer: 'マクロ',    impact: 'positive' },
  ],
  'stock': [
    { key: 'earnings',  label: '決算発表',      icon: '📊', layer: '競合',      impact: 'neutral' },
    { key: 'guidance',  label: '業績修正',      icon: '📈', layer: '競合',      impact: 'neutral' },
    { key: 'buyback',   label: '自社株買い',    icon: '💹', layer: '競合',      impact: 'positive' },
    { key: 'dividend',  label: '増配/減配',     icon: '💰', layer: '競合',      impact: 'neutral' },
    { key: 'ma',        label: 'M&A/提携',      icon: '🤝', layer: 'マクロ',    impact: 'neutral' },
    { key: 'regulation',label: '規制/政策',      icon: '📜', layer: 'マクロ',    impact: 'negative' },
  ],
  'keiba': [
    { key: 'race',      label: 'レース結果',    icon: '🏇', layer: '競合',      impact: 'neutral' },
    { key: 'training',  label: '調教情報',      icon: '🏋', layer: '競合',      impact: 'neutral' },
    { key: 'jockey',    label: '騎手変更',      icon: '👤', layer: '競合',      impact: 'neutral' },
    { key: 'track',     label: '馬場状態',      icon: '🌧', layer: 'マクロ',    impact: 'neutral' },
    { key: 'draw',      label: '枠順確定',      icon: '🎯', layer: '競合',      impact: 'neutral' },
    { key: 'odds',      label: 'オッズ変動',    icon: '📉', layer: 'ユーザー',  impact: 'neutral' },
  ],
  '_default': [
    { key: 'action',    label: '施策実行',      icon: '▶',  layer: 'ユーザー',  impact: 'neutral' },
    { key: 'external',  label: '外部イベント',  icon: '🌐', layer: 'マクロ',    impact: 'neutral' },
    { key: 'competitor',label: '競合の動き',     icon: '👁',  layer: '競合',      impact: 'neutral' },
    { key: 'issue',     label: '不具合/問題',    icon: '⚠',  layer: 'ユーザー',  impact: 'negative' },
    { key: 'positive',  label: '好材料',        icon: '✨', layer: 'マクロ',    impact: 'positive' },
    { key: 'negative',  label: '悪材料',        icon: '💥', layer: 'マクロ',    impact: 'negative' },
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
