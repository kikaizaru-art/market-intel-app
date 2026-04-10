/**
 * 共有定数 — カラーパレット、ラベル、設定値
 */

// 汎用カラーパレット
export const PALETTE = ['#388bfd', '#d2a8ff', '#56d364', '#e3b341', '#79c0ff']

export const ACCENT_ORANGE = '#f0883e'

// イベントタイプ
export const TYPE_COLORS = {
  'ガチャ': '#d2a8ff', 'コラボ': '#f0883e', 'シーズン': '#56d364',
  'キャンペーン': '#388bfd', 'アップデート': '#8b949e',
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

// ニュースタグ
export const TAG_COLORS = {
  '市場動向': '#388bfd', 'RPG': '#d2a8ff', '競合': '#f85149',
  'ストラテジー': '#e3b341', 'ランキング': '#79c0ff', '規制': '#f0883e',
  'Apple': '#8b949e', 'CPI': '#f85149', 'カジュアル': '#56d364',
  'Google': '#56d364', 'パズル': '#388bfd', '事前登録': '#d2a8ff', '決算': '#e3b341',
  '広告': '#f0883e', '海外展開': '#79c0ff', 'ストア': '#8b949e',
  'アクション': '#f85149', 'シミュレーション': '#f0883e',
}
