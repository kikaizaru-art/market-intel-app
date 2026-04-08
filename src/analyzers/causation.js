/**
 * 因果関係候補抽出アナライザー (Phase 3 予定)
 *
 * 考え方:
 *   1. 異常値検出で「何かが動いた日」を特定
 *   2. 前後 ±7日以内のイベントメモと突合せ
 *   3. 相関スコアを算出して「候補」として提示
 *   → Phase 3 では LLM による自然言語サマリーに発展させる
 */

/**
 * 異常値とイベントメモの時間的近接度を計算
 * @param {{ date: string }[]} anomalies
 * @param {{ date: string, event: string }[]} notes
 * @param {number} windowDays
 * @returns {object[]} 因果関係候補リスト
 */
export function findCausationCandidates(anomalies, notes, windowDays = 7) {
  const candidates = []

  for (const anomaly of anomalies) {
    const anomalyTime = new Date(anomaly.date).getTime()
    for (const note of notes) {
      const noteTime = new Date(note.date).getTime()
      const diffDays = Math.abs(anomalyTime - noteTime) / (1000 * 60 * 60 * 24)
      if (diffDays <= windowDays) {
        const direction = noteTime < anomalyTime ? 'before' : 'after'
        candidates.push({
          anomaly,
          note,
          diffDays: Math.round(diffDays),
          direction,
          proximityScore: 1 - diffDays / windowDays,
        })
      }
    }
  }

  return candidates.sort((a, b) => b.proximityScore - a.proximityScore)
}

// Phase 3 TODOs:
// - LLM (Claude API) でサマリー生成
// - 季節要因との突合せ（年次カレンダー）
// - 複数ジャンル間の相互影響分析
