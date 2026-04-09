import { useState, useRef, useEffect, useCallback } from 'react'
import MacroView from './components/MacroView.jsx'
import CompetitorView from './components/CompetitorView.jsx'
import UserView from './components/UserView.jsx'
import CausationView from './components/CausationView.jsx'
import MarketFundamentalsView from './components/MarketFundamentalsView.jsx'
import CorporateView from './components/CorporateView.jsx'
import EventCalendarView from './components/EventCalendarView.jsx'
import IndustryView from './components/IndustryView.jsx'

const TABS = [
  { key: 'macro',      label: 'マクロ環境',    accent: 'var(--accent-macro)' },
  { key: 'competitor',  label: '競合・企業',    accent: 'var(--accent-competitor)' },
  { key: 'user',        label: 'ユーザー',      accent: 'var(--accent-user)' },
  { key: 'industry',    label: '業界・イベント', accent: '#a5d6ff' },
]

export default function App() {
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

  /* swipe handling */
  const onTouchStart = useCallback((e) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }, [])

  const onTouchEnd = useCallback((e) => {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    /* only swipe if horizontal movement is dominant */
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) goTo(activeTab + 1)
      else goTo(activeTab - 1)
    }
    touchStartX.current = null
    touchStartY.current = null
  }, [activeTab, goTo])

  /* keyboard navigation */
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
          <span className="app-title">Market Intel</span>
          <span className="app-subtitle">ゲームアプリ広告市場 環境分析ダッシュボード</span>
          <span className="header-badge">Phase 1 MVP</span>
        </div>
        <div className="app-header-right">
          <span className="header-timestamp">更新: {now}</span>
        </div>
      </header>

      {/* === Tab Bar === */}
      <nav className="tab-bar">
        {TABS.map((tab, i) => (
          <button
            key={tab.key}
            className={`tab-btn ${i === activeTab ? 'active' : ''}`}
            style={{
              '--tab-accent': tab.accent,
            }}
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

      {/* === Slide Container === */}
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
          {/* Tab 0: マクロ環境 */}
          <section className="slide-pane">
            <div className="dashboard">
              <MacroView />
              <MarketFundamentalsView />
            </div>
          </section>

          {/* Tab 1: 競合・企業 */}
          <section className="slide-pane">
            <div className="dashboard">
              <CompetitorView />
              <CorporateView />
            </div>
          </section>

          {/* Tab 2: ユーザー */}
          <section className="slide-pane">
            <div className="dashboard">
              <UserView />
              <CausationView />
            </div>
          </section>

          {/* Tab 3: 業界・イベント */}
          <section className="slide-pane">
            <div className="dashboard">
              <IndustryView />
              <EventCalendarView />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
