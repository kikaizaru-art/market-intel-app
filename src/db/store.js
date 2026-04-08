/**
 * データ格納層
 *
 * Phase 1: JSONファイルベース（シンプルに）
 * Phase 2: SQLite に移行予定（better-sqlite3）
 *
 * スキーマ設計 (Phase 2):
 *   trends       (id, date, genre, value)
 *   ads          (id, advertiser, title, genre, format, started, status, reach, hook)
 *   reviews      (id, app_id, month, score, count, positive_ratio)
 *   notes        (id, date, event, app, layer, impact, memo, created_at)
 */

import fs from 'fs'
import path from 'path'

const DATA_DIR = new URL('../../data/', import.meta.url).pathname

/**
 * JSONファイルを読み込む（存在しない場合はdefaultValueを返す）
 */
export function readJson(filename, defaultValue = null) {
  const filepath = path.join(DATA_DIR, filename)
  if (!fs.existsSync(filepath)) return defaultValue
  return JSON.parse(fs.readFileSync(filepath, 'utf8'))
}

/**
 * JSONファイルに書き込む
 */
export function writeJson(filename, data) {
  const filepath = path.join(DATA_DIR, filename)
  fs.mkdirSync(path.dirname(filepath), { recursive: true })
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2))
}

/**
 * 最新の日付のデータファイルを返す
 */
export function getLatestFile(prefix) {
  const files = fs.readdirSync(DATA_DIR)
    .filter(f => f.startsWith(prefix) && f.endsWith('.json'))
    .sort()
    .reverse()
  if (!files.length) return null
  return readJson(files[0])
}

/**
 * メモ（因果関係ノート）を追記保存
 */
export function appendNote(note) {
  const filepath = path.join(DATA_DIR, 'causation-notes.json')
  let data = { notes: [] }
  if (fs.existsSync(filepath)) {
    data = JSON.parse(fs.readFileSync(filepath, 'utf8'))
  }
  data.notes.unshift({ id: `note_${Date.now()}`, ...note })
  writeJson('causation-notes.json', data)
  return data
}
