import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useTarget } from './context/TargetContext.jsx'
import { useDomain } from './context/DomainContext.jsx'
import SearchView from './components/SearchView.jsx'
import PositionView from './components/PositionView.jsx'
import HistoryView from './components/HistoryView.jsx'
import ActionsView from './components/ActionsView.jsx'
import DebugPanel from './components/DebugPanel.jsx'

// ドメインで宣言可能なタブセット (config.tabs で順序・取捨を変更できる)
const TAB_CATALOG = {
  position: { key: 'position', label: '現在地',    accent: '#56d364' },
  history:  { key: 'history',  label: '推移',      accent: '#388bfd' },
  actions:  { key: 'actions',  label: '次の一手',  accent: '#d2a8ff' },
}
const DEFAULT_TABS = ['position', 'history', 'actions']

function Dashboard() {
  const { target, data, dataSources, dataMode, setDataMode, hasCollected, reset } = useTarget()
  const { config, ui } = useDomain()
  const [activeTab, setActiveTab] = useState(0)
  const touchStartX = useRef(null)
  const touchStartY = useRef(null)
  const sliderRef = useRef(null)

  // ドメイン config の tabs を正規化 (不明キーは除外、空なら DEFAULT_TABS)
  const TABS = useMemo(() => {
    const list = Array.isArray(config?.tabs) && config.tabs.length ? config.tabs : DEFAULT_TABS
    return list.map(k => TAB_CATALOG[k]).filter(Boolean)
  }, [config?.tabs])

  const now = new Date().toLocaleString('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })

  const goTo = useCallback((idx) => {
    setActiveTab(Math.max(0, Math.min(TABS.length - 1, idx)))
  }, [TABS.length])

  const onTouchStart = useCallback((e) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }, [])

  const onTouchEnd = useCallback((e) => {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) goTo(activeTab + 1)
      else goTo(activeTab - 1)
    }
    touchStartX.current = null
    touchStartY.current = null
  }, [activeTab, goTo])

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowLeft') goTo(activeTab - 1)
      if (e.key === 'ArrowRight') goTo(activeTab + 1)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeTab, goTo])

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-left">
          <button className="back-btn" onClick={reset} title="検索に戻る">
            &larr;
          </button>
          <span className="app-title">Market Intel</span>
          <span className="header-badge domain-badge" style={{ background: `${ui.accent}18`, color: ui.accent, border: `1px solid ${ui.accent}44` }}>
            {ui.icon} {config.name}
          </span>
          <span className="app-subtitle">{target.appName} の分析</span>
          <span className="header-badge">{target.genre}</span>
        </div>
        <div className="app-header-right">
          <span className="header-target-name">{target.companyName}</span>
          <button
            type="button"
            className="header-badge data-mode-toggle"
            onClick={() => setDataMode(dataMode === 'mock' ? 'auto' : 'mock')}
            title={
              dataMode === 'mock'
                ? 'モックデータ表示中（クリックで実データに切替）'
                : hasCollected
                  ? '実データ表示中（クリックでモックに切替）'
                  : '実データ未取得（クリックでモック固定に切替）'
            }
            style={
              dataMode === 'mock'
                ? { background: 'rgba(210,168,255,0.15)', color: '#d2a8ff', border: '1px solid rgba(210,168,255,0.3)', cursor: 'pointer' }
                : dataSources
                  ? { background: 'rgba(86,211,100,0.15)', color: '#56d364', border: '1px solid rgba(86,211,100,0.3)', cursor: 'pointer' }
                  : { background: 'rgba(139,148,158,0.15)', color: '#8b949e', border: '1px solid rgba(139,148,158,0.3)', cursor: 'pointer' }
            }
          >
            {dataMode === 'mock' ? 'モック' : dataSources ? '実データ' : 'モック(既定)'}
          </button>
          <span className="header-timestamp">更新: {now}</span>
        </div>
      </header>

      <nav className="tab-bar">
        {TABS.map((tab, i) => (
          <button
            key={tab.key}
            className={`tab-btn ${i === activeTab ? 'active' : ''}`}
            style={{ '--tab-accent': tab.accent }}
            onClick={() => goTo(i)}
          >
            {tab.label}
          </button>
        ))}
        {TABS.length > 0 && (
          <div
            className="tab-indicator"
            style={{
              width: `${100 / TABS.length}%`,
              transform: `translateX(${activeTab * 100}%)`,
              background: (TABS[activeTab] || TABS[0]).accent,
            }}
          />
        )}
      </nav>

      <div
        className="slide-viewport"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="slide-track"
          ref={sliderRef}
          style={{ transform: `translateX(-${activeTab * 100}%)` }}
        >
          {TABS.map(t => (
            <section key={t.key} className="slide-pane">
              <div className="dashboard">
                {t.key === 'position' && (
                  <PositionView
                    target={target}
                    reviews={data.reviews}
                    fundamentals={data.fundamentals}
                    trends={data.trends}
                    industry={data.industry}
                    corporate={data.corporate}
                    events={data.events}
                    causation={data.causation}
                    ranking={data.ranking}
                    community={data.community}
                    twitter={data.twitter}
                  />
                )}
                {t.key === 'history' && (
                  <HistoryView
                    target={target}
                    reviews={data.reviews}
                    fundamentals={data.fundamentals}
                    trends={data.trends}
                    industry={data.industry}
                    events={data.events}
                    ranking={data.ranking}
                    community={data.community}
                    twitter={data.twitter}
                  />
                )}
                {t.key === 'actions' && (
                  <ActionsView
                    causation={data.causation}
                    trends={data.trends}
                    reviews={data.reviews}
                    events={data.events}
                    industry={data.industry}
                  />
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const { target, setTarget } = useTarget()

  return (
    <>
      {!target ? <SearchView onSubmit={setTarget} /> : <Dashboard />}
      <DebugPanel />
    </>
  )
}
