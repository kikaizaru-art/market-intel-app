/**
 * 共有ユーティリティ関数
 */

/**
 * 日付文字列を月表示に変換（月初のみラベル表示）
 */
export function formatDate(dateStr) {
  const [, month, day] = dateStr.split('-')
  return day === '05' || day === '04' || day === '01' ? `${parseInt(month)}月` : ''
}

/**
 * イベントが現在開催中か判定
 */
export function isActive(event, today) {
  if (!event.end) return event.start <= today
  return event.start <= today && event.end >= today
}

/**
 * 今日の日付を YYYY-MM-DD 形式で取得
 */
export function getToday() {
  return new Date().toISOString().slice(0, 10)
}
