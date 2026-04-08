/**
 * 異常値検出アナライザー
 * 急上昇 / 急下降のアラートを生成する
 */

/**
 * 標準偏差
 */
function stddev(values) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const sq = values.map(v => (v - mean) ** 2)
  return Math.sqrt(sq.reduce((a, b) => a + b, 0) / values.length)
}

/**
 * Zスコアベースの異常値検出
 * @param {number[]} values
 * @param {number} threshold
 * @returns {{ index: number, value: number, zscore: number, type: 'spike'|'drop' }[]}
 */
export function detectAnomalies(values, threshold = 2.0) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const sd = stddev(values)
  if (sd === 0) return []

  return values
    .map((v, i) => ({ index: i, value: v, zscore: (v - mean) / sd }))
    .filter(({ zscore }) => Math.abs(zscore) >= threshold)
    .map(({ index, value, zscore }) => ({
      index,
      value,
      zscore: zscore.toFixed(2),
      type: zscore > 0 ? 'spike' : 'drop',
    }))
}

/**
 * weekly データから全ジャンルの異常値を検出
 * @param {object[]} weekly
 * @param {string[]} genres
 * @returns {object[]} アラートリスト
 */
export function detectAllAnomalies(weekly, genres) {
  const alerts = []
  for (const genre of genres) {
    const values = weekly.map(w => w[genre] ?? 0)
    const anomalies = detectAnomalies(values)
    for (const a of anomalies) {
      alerts.push({
        genre,
        date: weekly[a.index]?.date,
        value: a.value,
        zscore: a.zscore,
        type: a.type,
        severity: Math.abs(a.zscore) >= 3 ? 'high' : 'medium',
      })
    }
  }
  return alerts.sort((a, b) => Math.abs(b.zscore) - Math.abs(a.zscore))
}
