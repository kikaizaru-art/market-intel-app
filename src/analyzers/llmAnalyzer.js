/**
 * LLM を活用した高度な分析モジュール
 *
 * - 因果パターンの自然言語サマリー生成
 * - 季節要因との突合せ分析
 * - LLM 未接続時はテンプレートベースのフォールバック
 */

import { chat, isAvailable } from '../dashboard/services/llmService.js'

// ─── システムプロンプト ────────────────────────────────────────

const CAUSATION_SYSTEM_PROMPT = `あなたはマーケットインテリジェンスの分析アシスタントです。
与えられた因果パターンデータを分析し、簡潔で実用的なサマリーを日本語で生成してください。

ルール:
- 箇条書きで3〜5項目にまとめる
- 各項目は1〜2文で簡潔に
- 信頼度の高いパターンを優先的に言及する
- 「〜の可能性がある」「〜の傾向が見られる」など断定を避ける表現を使う
- データにない推測は加えない`

const SEASONAL_SYSTEM_PROMPT = `あなたはマーケットインテリジェンスの分析アシスタントです。
時系列データから季節的なパターンを分析し、日本語で報告してください。

ルール:
- 月別の傾向を簡潔に述べる
- 過去データとの一致・不一致を指摘する
- 「例年通り」「例年と異なり」などの表現で季節性を評価する
- 3〜5項目の箇条書きでまとめる`

// ─── 因果サマリー生成 ──────────────────────────────────────────

/**
 * 因果パターンの自然言語サマリーを生成
 *
 * @param {object} params
 * @param {object[]} params.memos - 因果メモ一覧
 * @param {object} params.risks - リスク情報
 * @param {object} params.opportunities - チャンス情報
 * @param {object} params.learningStats - 学習統計
 * @returns {Promise<{ summary: string, source: 'llm'|'template' }>}
 */
export async function generateCausationSummary({ memos, risks, opportunities, learningStats }) {
  if (isAvailable() && memos.length > 0) {
    const userMessage = buildCausationPrompt({ memos, risks, opportunities, learningStats })
    const result = await chat(CAUSATION_SYSTEM_PROMPT, userMessage)
    if (result) {
      return { summary: result.trim(), source: 'llm' }
    }
  }

  // フォールバック: テンプレートベース
  return {
    summary: buildTemplateSummary({ memos, risks, opportunities, learningStats }),
    source: 'template',
  }
}

function buildCausationPrompt({ memos, risks, opportunities, learningStats }) {
  const recentMemos = memos
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 15)

  const lines = ['## 因果パターンデータ\n']

  if (recentMemos.length > 0) {
    lines.push('### 直近の因果メモ')
    for (const m of recentMemos) {
      const conf = m.confidence != null ? ` (信頼度: ${(m.confidence * 100).toFixed(0)}%)` : ''
      lines.push(`- [${m.date}] ${m.event}${conf}`)
      if (m.memo) lines.push(`  詳細: ${m.memo}`)
    }
    lines.push('')
  }

  if (opportunities?.length > 0) {
    lines.push('### チャンス (上昇トレンド)')
    for (const o of opportunities) {
      lines.push(`- ${o.genre}: +${o.pop4w}% (4週間)`)
    }
    lines.push('')
  }

  if (risks?.length > 0) {
    lines.push('### リスク')
    for (const r of risks) {
      if (r.type === 'trend') {
        lines.push(`- ${r.genre}: ${r.pop4w}% (下降トレンド)`)
      } else if (r.type === 'anomaly') {
        lines.push(`- ${r.genre}: 異常値検出 (${r.date})`)
      } else if (r.name) {
        lines.push(`- ${r.name}: レビュー急落 (${r.diff})`)
      }
    }
    lines.push('')
  }

  if (learningStats) {
    lines.push('### 学習状況')
    lines.push(`- 累計検証: ${learningStats.totalFeedback}件`)
    lines.push(`- 的中率: ${learningStats.accuracy}%`)
    lines.push('')
  }

  lines.push('上記データを踏まえて、現在の状況と注意すべきポイントをサマリーしてください。')
  return lines.join('\n')
}

// ─── 季節要因分析 ──────────────────────────────────────────────

/**
 * 季節パターンの分析を生成
 *
 * @param {object} params
 * @param {object[]} params.weeklyData - 週次トレンドデータ
 * @param {string[]} params.metrics - メトリクス名一覧
 * @param {object[]} params.seasonalPatterns - ドメイン設定の季節パターン
 * @param {object[]} params.historicalMemos - 過去の因果メモ
 * @returns {Promise<{ analysis: string, source: 'llm'|'template' }>}
 */
export async function analyzeSeasonalPatterns({ weeklyData, metrics, seasonalPatterns, historicalMemos }) {
  if (isAvailable() && weeklyData?.length > 0) {
    const userMessage = buildSeasonalPrompt({ weeklyData, metrics, seasonalPatterns, historicalMemos })
    const result = await chat(SEASONAL_SYSTEM_PROMPT, userMessage)
    if (result) {
      return { analysis: result.trim(), source: 'llm' }
    }
  }

  return {
    analysis: buildTemplateSeasonalAnalysis({ weeklyData, metrics, seasonalPatterns }),
    source: 'template',
  }
}

function buildSeasonalPrompt({ weeklyData, metrics, seasonalPatterns, historicalMemos }) {
  const lines = ['## 季節分析データ\n']

  // 月別集計
  const monthlyAgg = {}
  for (const w of weeklyData) {
    const month = new Date(w.date).getMonth() + 1
    if (!monthlyAgg[month]) monthlyAgg[month] = {}
    for (const m of metrics) {
      if (!monthlyAgg[month][m]) monthlyAgg[month][m] = []
      if (w[m] != null) monthlyAgg[month][m].push(w[m])
    }
  }

  lines.push('### 月別メトリクス平均')
  for (const [month, mData] of Object.entries(monthlyAgg).sort((a, b) => a[0] - b[0])) {
    const parts = Object.entries(mData).map(([m, vals]) => {
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length
      return `${m}: ${avg.toFixed(1)}`
    })
    lines.push(`- ${month}月: ${parts.join(', ')}`)
  }
  lines.push('')

  if (seasonalPatterns?.length > 0) {
    lines.push('### 設定済み季節パターン')
    for (const p of seasonalPatterns) {
      lines.push(`- ${p.month}月: ${p.event} (${p.impact})`)
    }
    lines.push('')
  }

  // 過去の同月メモ
  const currentMonth = new Date().getMonth() + 1
  const sameMonthMemos = (historicalMemos || []).filter(m => {
    const mMonth = new Date(m.date).getMonth() + 1
    return mMonth === currentMonth
  })
  if (sameMonthMemos.length > 0) {
    lines.push(`### 過去の${currentMonth}月のイベント`)
    for (const m of sameMonthMemos.slice(0, 10)) {
      lines.push(`- [${m.date}] ${m.event}`)
    }
    lines.push('')
  }

  lines.push('現在の月と過去の季節パターンを比較し、今月の注意点を分析してください。')
  return lines.join('\n')
}

// ─── フォールバック: テンプレートベースの生成 ──────────────────

function buildTemplateSummary({ memos, risks, opportunities, learningStats }) {
  const lines = []
  const recentMemos = memos
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 5)

  // チャンス
  if (opportunities?.length > 0) {
    const names = opportunities.map(o => `${o.genre}(+${o.pop4w}%)`).join('、')
    lines.push(`- 上昇トレンド: ${names}`)
  }

  // リスク
  const trendRisks = (risks || []).filter(r => r.type === 'trend')
  const reviewRisks = (risks || []).filter(r => r.name)
  if (trendRisks.length > 0) {
    const names = trendRisks.map(r => `${r.genre}(${r.pop4w}%)`).join('、')
    lines.push(`- 下降トレンド: ${names}`)
  }
  if (reviewRisks.length > 0) {
    const names = reviewRisks.map(r => `${r.name}(${r.diff})`).join('、')
    lines.push(`- レビュー急落: ${names}`)
  }

  // 高信頼メモ
  const highConf = recentMemos.filter(m => m.confidence >= 0.7)
  if (highConf.length > 0) {
    lines.push(`- 高信頼パターン: ${highConf.length}件検出`)
    for (const m of highConf.slice(0, 3)) {
      lines.push(`  ${m.event} (信頼度${(m.confidence * 100).toFixed(0)}%)`)
    }
  }

  // 学習状況
  if (learningStats?.totalFeedback > 0) {
    lines.push(`- 学習進捗: ${learningStats.totalFeedback}件検証済み (的中率${learningStats.accuracy}%)`)
  }

  if (lines.length === 0) {
    lines.push('- データ蓄積中。因果パターンが検出され次第、ここにサマリーが表示されます。')
  }

  return lines.join('\n')
}

function buildTemplateSeasonalAnalysis({ weeklyData, metrics, seasonalPatterns }) {
  const lines = []
  const currentMonth = new Date().getMonth() + 1

  // 今月の季節パターン
  const thisMonthPatterns = (seasonalPatterns || []).filter(p => p.month === currentMonth)
  if (thisMonthPatterns.length > 0) {
    lines.push(`- 今月(${currentMonth}月)の季節パターン:`)
    for (const p of thisMonthPatterns) {
      lines.push(`  ${p.event} (${p.impact === 'positive' ? '追い風' : p.impact === 'negative' ? '逆風' : '中立'})`)
    }
  }

  // 直近の動き
  if (weeklyData?.length >= 4 && metrics?.length > 0) {
    const last4 = weeklyData.slice(-4)
    const prev4 = weeklyData.slice(-8, -4)
    if (prev4.length >= 4) {
      for (const m of metrics.slice(0, 3)) {
        const recentAvg = last4.reduce((s, w) => s + (w[m] || 0), 0) / 4
        const prevAvg = prev4.reduce((s, w) => s + (w[m] || 0), 0) / 4
        if (prevAvg > 0) {
          const change = ((recentAvg - prevAvg) / prevAvg * 100).toFixed(1)
          lines.push(`- ${m}: 直近4週 vs 前4週 ${change > 0 ? '+' : ''}${change}%`)
        }
      }
    }
  }

  if (lines.length === 0) {
    lines.push('- 季節パターン分析にはより多くのデータ蓄積が必要です。')
  }

  return lines.join('\n')
}
