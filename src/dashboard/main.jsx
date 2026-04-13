import React from 'react'
import ReactDOM from 'react-dom/client'
import { DomainProvider } from './context/DomainContext.jsx'
import { TargetProvider } from './context/TargetContext.jsx'
import App from './App.jsx'
import './index.css'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, color: '#e6edf3', background: '#0d1117', minHeight: '100vh', fontFamily: 'monospace' }}>
          <h2 style={{ color: '#f85149' }}>Error</h2>
          <pre style={{ color: '#8b949e', whiteSpace: 'pre-wrap' }}>{this.state.error.message}</pre>
          <button onClick={() => this.setState({ error: null })} style={{ marginTop: 16, padding: '8px 16px', background: '#388bfd', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <DomainProvider>
        <TargetProvider>
          <App />
        </TargetProvider>
      </DomainProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
