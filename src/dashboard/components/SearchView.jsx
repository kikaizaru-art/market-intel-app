import { useState, useCallback } from 'react'
import { getAvailableGenres } from '../services/generateData.js'

const GENRES = getAvailableGenres()

const PRESETS = [
  { appName: 'モンスターストライク', companyName: 'MIXI', genre: 'RPG' },
  { appName: 'パズル&ドラゴンズ', companyName: 'ガンホー', genre: 'パズル' },
  { appName: 'Clash Royale', companyName: 'Supercell', genre: 'ストラテジー' },
  { appName: 'ウマ娘', companyName: 'Cygames', genre: 'シミュレーション' },
]

export default function SearchView({ onSubmit }) {
  const [appName, setAppName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [genre, setGenre] = useState('RPG')
  const [loading, setLoading] = useState(false)

  const handleSubmit = useCallback((e) => {
    e.preventDefault()
    if (!appName.trim()) return
    setLoading(true)
    // Small delay to show loading state (data generation is sync but fast)
    requestAnimationFrame(() => {
      onSubmit({ appName: appName.trim(), companyName: companyName.trim() || appName.trim(), genre })
    })
  }, [appName, companyName, genre, onSubmit])

  const handlePreset = useCallback((preset) => {
    setLoading(true)
    requestAnimationFrame(() => {
      onSubmit(preset)
    })
  }, [onSubmit])

  return (
    <div className="search-page">
      <div className="search-container">
        <div className="search-logo">
          <span className="search-logo-icon">M</span>
          <span className="search-logo-text">Market Intel</span>
        </div>
        <p className="search-description">
          アプリ名を入力すると、競合分析・市場トレンド・ユーザー評価などのデータを収集します
        </p>

        <form className="search-form" onSubmit={handleSubmit}>
          <div className="search-field-group">
            <label className="search-label">アプリ名 <span className="search-required">*</span></label>
            <input
              type="text"
              className="search-input search-input-main"
              placeholder="例: モンスターストライク"
              value={appName}
              onChange={e => setAppName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="search-row">
            <div className="search-field-group" style={{ flex: 1 }}>
              <label className="search-label">企業名</label>
              <input
                type="text"
                className="search-input"
                placeholder="例: MIXI（任意）"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
              />
            </div>
            <div className="search-field-group">
              <label className="search-label">ジャンル</label>
              <select
                className="search-select"
                value={genre}
                onChange={e => setGenre(e.target.value)}
              >
                {GENRES.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="search-submit"
            disabled={!appName.trim() || loading}
          >
            {loading ? (
              <span className="search-spinner" />
            ) : (
              'データ収集開始'
            )}
          </button>
        </form>

        <div className="search-presets">
          <span className="search-presets-label">クイック分析:</span>
          <div className="search-presets-list">
            {PRESETS.map((p, i) => (
              <button
                key={i}
                className="search-preset-btn"
                onClick={() => handlePreset(p)}
                disabled={loading}
              >
                {p.appName}
              </button>
            ))}
          </div>
        </div>

        <div className="search-footer">
          Phase 2 — <code>npm run collect</code> で実データを収集できます。収集データがない場合はモック生成を使用します。
        </div>
      </div>
    </div>
  )
}
