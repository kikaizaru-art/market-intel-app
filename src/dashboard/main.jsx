import React from 'react'
import ReactDOM from 'react-dom/client'
import { TargetProvider } from './context/TargetContext.jsx'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <TargetProvider>
      <App />
    </TargetProvider>
  </React.StrictMode>
)
