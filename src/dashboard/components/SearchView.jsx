import { useState, useCallback } from 'react'
import { getAvailableGenres } from '../services/generateData.js'
import { useDomain } from '../context/DomainContext.jsx'

const GENRES = getAvailableGenres()

export default function SearchView({ onSubmit }) {
  const { domainId, config, ui, domainList, setDomain } = useDomain()
  const [appName, setAppName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [genre, setGenre] = useState(GENRES[0])
  const [loading, setLoading] = useState(false)

  const categories = domainId === 'game-market'
    ? GENRES
    : config.categories || []

  const handleSubmit = useCallback((e) => {
    e.preventDefault()
    if (!appName.trim()) return
    setLoading(true)
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

  const handleDomainSwitch = useCallback((id) => {
    setDomain(id)
    setAppName('')
    setCompanyName('')
    setLoading(false)
  }, [setDomain])

  const isReady = domainList.find(d => d.id === domainId)?.ready

  return (
    <div className="search-page">
      <div className="search-container">
        <div className="search-logo">
          <span className="search-logo-icon">M</span>
          <span className="search-logo-text">Market Intel</span>
        </div>
        <p className="search-description">
          {config.description}
        </p>

        {/* Domain Selector */}
        <div className="domain-selector">
          {domainList.map((d) => (
            <button
              key={d.id}
              className={`domain-btn ${d.id === domainId ? 'active' : ''}`}
              style={{
                '--domain-accent': d.accent,
              }}
              onClick={() => handleDomainSwitch(d.id)}
            >
              <span className="domain-btn-icon">{d.icon}</span>
              <span className="domain-btn-name">{d.name}</span>
              {!d.ready && <span className="domain-btn-badge">Preview</span>}
            </button>
          ))}
        </div>

        <form className="search-form" onSubmit={handleSubmit}>
          <div className="search-field-group">
            <label className="search-label">{ui.targetLabel} <span className="search-required">*</span></label>
            <input
              type="text"
              className="search-input search-input-main"
              placeholder={ui.targetPlaceholder}
              value={appName}
              onChange={e => setAppName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="search-row">
            <div className="search-field-group" style={{ flex: 1 }}>
              <label className="search-label">{ui.subLabel}</label>
              <input
                type="text"
                className="search-input"
                placeholder={ui.subPlaceholder}
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
              />
            </div>
            <div className="search-field-group">
              <label className="search-label">{ui.categoryLabel}</label>
              <select
                className="search-select"
                value={genre}
                onChange={e => setGenre(e.target.value)}
              >
                {categories.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="search-submit"
            disabled={!appName.trim() || loading}
            style={!isReady ? { opacity: 0.85 } : undefined}
          >
            {loading ? (
              <span className="search-spinner" />
            ) : (
              isReady ? 'データ収集開始' : 'モックデータで分析開始'
            )}
          </button>
        </form>

        <div className="search-presets">
          <span className="search-presets-label">クイック分析:</span>
          <div className="search-presets-list">
            {ui.presets.map((p, i) => (
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
          {isReady ? (
            <>Phase 2 — <code>npm run collect</code> で実データを収集できます。収集データがない場合はモック生成を使用します。</>
          ) : (
            <>
              <span style={{ color: ui.accent }}>{config.name}</span> — データコレクター開発中。モックデータでダッシュボードの動作を確認できます。
            </>
          )}
        </div>
      </div>
    </div>
  )
}
