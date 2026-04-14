import { useState, useRef, useEffect, useCallback } from 'react'
import { useTarget } from './context/TargetContext.jsx'
import { useDomain } from './context/DomainContext.jsx'
import SearchView from './components/SearchView.jsx'
import PositionView from './components/PositionView.jsx'
import HistoryView from './components/HistoryView.jsx'
import ActionsView from './components/ActionsView.jsx'

const TABS = [
  { key: 'position', label: '現在地',    accent: '#56d364' },
  { key: 'history',  label: '推移',      accent: '#388bfd' },
  { key: 'actions',  label: '次の一手',  accent: '#d2a8ff' },
]

function Dashboard() {
  const { target, data, dataSources, reset } = useTarget()
  const { config, ui } = useDomain()
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
          <span className="header-badge domain-badge" style={{ background: `${ui.accent}18`, color: ui.accent, border: `1px solid ${ui.accent}44` }}>
            {ui.icon} {config.name}
          </span>
          <span className="app-subtitle">{target.appName} の分析</span>
          <span className="header-badge">{target.genre}</span>
        </div>
        <div className="app-header-right">
          <span className="header-target-name">{target.companyName}</span>
          {dataSources && (
            <span className="header-badge" style={{ background: 'rgba(86,211,100,0.15)', color: '#56d364', border: '1px solid rgba(86,211,100,0.3)' }}>
              実データ
            </span>
          )}
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
          {/* ━━━ 現在地 ━━━ */}
          <section className="slide-pane">
            <div className="dashboard">
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
              />
            </div>
          </section>

          {/* ━━━ 推移 ━━━ */}
          <section className="slide-pane">
            <div className="dashboard">
              <HistoryView
                target={target}
                reviews={data.reviews}
                fundamentals={data.fundamentals}
                trends={data.trends}
                industry={data.industry}
                events={data.events}
                ranking={data.ranking}
                community={data.community}
              />
            </div>
          </section>

          {/* ━━━ 次の一手 ━━━ */}
          <section className="slide-pane">
            <div className="dashboard">
              <ActionsView
                causation={data.causation}
                trends={data.trends}
                reviews={data.reviews}
                events={data.events}
                industry={data.industry}
              />
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
