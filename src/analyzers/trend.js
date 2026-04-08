/**
 * トレンド検出アナライザー
 * 移動平均・前期比でジャンルの勢いを数値化する
 */

/**
 * 単純移動平均
 * @param {number[]} values
 * @param {number} window
 * @returns {number[]}
 */
export function movingAverage(values, window = 4) {
  return values.map((_, i) => {
    if (i < window - 1) return null
    const slice = values.slice(i - window + 1, i + 1)
    return slice.reduce((a, b) => a + b, 0) / window
  })
}

/**
 * 前期比（%）
 * @param {number[]} values
 * @param {number} lag
 * @returns {number[]}
 */
export function periodOverPeriod(values, lag = 4) {
  return values.map((v, i) => {
    if (i < lag || values[i - lag] === 0) return null
    return ((v - values[i - lag]) / values[i - lag]) * 100
  })
}

/**
 * ジャンルごとのトレンドスコアを算出
 * @param {object[]} weekly - trends.json の weekly 配列
 * @param {string[]} genres
 * @returns {object} { genre: { latestMA, pop4w, trend } }
 */
export function calcGenreTrends(weekly, genres) {
  const result = {}
  for (const genre of genres) {
    const values = weekly.map(w => w[genre] ?? 0)
    const ma = movingAverage(values)
    const pop = periodOverPeriod(values)
    const latestMA = ma.filter(Boolean).at(-1)
    const pop4w = pop.filter(Boolean).at(-1)
    result[genre] = {
      latestMA: latestMA?.toFixed(1),
      pop4w: pop4w?.toFixed(1),
      trend: pop4w > 5 ? 'rising' : pop4w < -5 ? 'falling' : 'stable',
    }
  }
  return result
}
