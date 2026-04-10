import { useState, useRef, useEffect, useCallback } from 'react'
import { useTarget } from './context/TargetContext.jsx'
import SearchView from './components/SearchView.jsx'
import UserView from './components/UserView.jsx'
import CausationView from './components/CausationView.jsx'
import MarketFundamentalsView from './components/MarketFundamentalsView.jsx'
import CorporateView from './components/CorporateView.jsx'
import IndustryView from './components/IndustryView.jsx'

const TABS = [
  { key: 'user',        label: 'ユーザー',      accent: 'var(--accent-user)' },
  { key: 'industry',    label: '業界・イベント', accent: '#a5d6ff' },
]

function Dashboard() {
  const { target, data, reset } = useTarget()
  const [activeTab, setActiveTab] = useState(0)
  const touchStartX = useRef(null)
  const touchStartY = useRef(null)
  const sliderRef = useRef(null)

  const now = new Date().toLocaleString('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })

  const goTo = useCallback((idx) => {
    setActiveTab(Math.max(0, Math.min(TABS.length - 1, idx)))
  }, [])

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
          <span className="app-subtitle">{target.appName} の競合環境分析</span>
          <span className="header-badge">{target.genre}</span>
        </div>
        <div className="app-header-right">
          <span className="header-target-name">{target.companyName}</span>
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
        <div
          className="tab-indicator"
          style={{
            width: `${100 / TABS.length}%`,
            transform: `translateX(${activeTab * 100}%)`,
            background: TABS[activeTab].accent,
          }}
        />
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
          <section className="slide-pane">
            <div className="dashboard">
              <UserView data={data.reviews} />
              <CausationView data={data.causation} />
            </div>
          </section>

          <section className="slide-pane">
            <div className="dashboard">
              <MarketFundamentalsView data={data.fundamentals} eventsData={data.events} newsData={data.industry?.news} />
              <CorporateView data={data.corporate} />
              <IndustryView data={data.industry} trendsData={data.trends} />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const { target, setTarget } = useTarget()

  if (!target) {
    return <SearchView onSubmit={setTarget} />
  }

  return <Dashboard />
}
