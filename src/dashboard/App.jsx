import MacroView from './components/MacroView.jsx'
import CompetitorView from './components/CompetitorView.jsx'
import UserView from './components/UserView.jsx'
import CausationView from './components/CausationView.jsx'

export default function App() {
  const now = new Date().toLocaleString('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })

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

      <main className="dashboard">
        <MacroView />
        <CompetitorView />
        <UserView />
        <CausationView />
      </main>
    </div>
  )
}
