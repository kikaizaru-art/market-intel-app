/**
 * 4層モデル抽象定義
 *
 * フレームワークの骨格となる4つの環境変数レイヤー。
 * ドメインが変わっても、この4層構造は不変。
 *
 * L1 マクロ   — 市場全体の潮流 (前提条件)
 * L2 競合     — 直接比較対象の動向 (差別化・機会)
 * L3 ユーザー — 末端の反応と感情 (先行指標)
 * L4 因果関係 — 上記3層から抽出された因果パターン蓄積 (学習)
 */

/**
 * レイヤー名定数
 */
export const LAYERS = {
  MACRO: 'macro',
  COMPETITOR: 'competitor',
  USER: 'user',
  CAUSAL: 'causal',
}

/**
 * 各レイヤーのメタ定義
 * UI表示やドキュメント生成に使用
 */
export const LAYER_META = {
  [LAYERS.MACRO]: {
    order: 1,
    icon: '🌍',
    role: '前提条件',
    description: '市場全体の潮流。個別の意思決定の前提条件を形成する',
    updateFrequency: 'daily',
  },
  [LAYERS.COMPETITOR]: {
    order: 2,
    icon: '⚔️',
    role: '差別化・機会',
    description: '直接比較可能な対象の動向。差別化ポイントと機会を発見する',
    updateFrequency: 'daily',
  },
  [LAYERS.USER]: {
    order: 3,
    icon: '👥',
    role: '先行指標',
    description: '末端の反応と感情。最も早く変化を捕捉できる先行指標',
    updateFrequency: 'daily',
  },
  [LAYERS.CAUSAL]: {
    order: 4,
    icon: '🔗',
    role: '学習・蓄積',
    description: '上記3層から自動抽出される因果パターン。時間とともに精度向上',
    updateFrequency: 'continuous',
  },
}

/**
 * 統一時系列データポイント
 * 全ドメイン・全コレクターの出力をこのフォーマットに正規化する
 *
 * @typedef {object} DataPoint
 * @property {string} date       - ISO日付 (YYYY-MM-DD)
 * @property {string} metric     - メトリクス名 (ジャンル名/銘柄コード/馬名 etc.)
 * @property {number} value      - 数値
 * @property {string} source     - コレクター名
 * @property {string} layer      - レイヤー (macro/competitor/user)
 * @property {object} [metadata] - ドメイン固有の追加情報
 */

/**
 * 統一因果メモ
 *
 * @typedef {object} CausalMemo
 * @property {string} id
 * @property {string} date
 * @property {string} event       - パターンの説明
 * @property {string} target      - 対象名 (アプリ/銘柄/馬 etc.)
 * @property {string} layer       - 検出元レイヤー
 * @property {string} impact      - positive/negative/neutral
 * @property {string} memo        - 詳細説明
 * @property {boolean} auto       - 自動生成フラグ
 * @property {string} patternType - パターンタイプ
 * @property {number} confidence  - 信頼度 (0-1)
 * @property {string[]} signals   - 検出シグナル
 * @property {string} domain      - ドメイン名
 * @property {object} _validation - 検証用内部データ
 */

/**
 * 生データを統一 DataPoint に変換するヘルパー
 *
 * @param {object} raw - 生データ
 * @param {string} source - コレクター名
 * @param {string} layer - レイヤー名
 * @param {function} extractFn - (raw) => { date, metric, value, metadata }[]
 * @returns {DataPoint[]}
 */
export function normalizeToDataPoints(raw, source, layer, extractFn) {
  const extracted = extractFn(raw)
  return extracted.map(item => ({
    date: item.date,
    metric: item.metric,
    value: item.value,
    source,
    layer,
    metadata: item.metadata || {},
  }))
}

/**
 * DataPoint配列をメトリクス別の時系列に変換
 * アナライザーが期待する { weekly: [{ date, [metric]: value }] } 形式
 *
 * @param {DataPoint[]} dataPoints
 * @returns {{ weekly: object[], _metrics: string[] }}
 */
export function toTimeSeries(dataPoints) {
  const byDate = {}
  const metrics = new Set()

  for (const dp of dataPoints) {
    if (!byDate[dp.date]) byDate[dp.date] = { date: dp.date }
    byDate[dp.date][dp.metric] = dp.value
    metrics.add(dp.metric)
  }

  const weekly = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date))
  return { weekly, _metrics: [...metrics] }
}
